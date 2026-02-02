/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Simen. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

#include <napi.h>
#include <map>
#include <mutex>
#include <string>
#include "apple_speech.h"

#if defined(__APPLE__)

// Store JS callbacks per session
struct SessionCallbacks {
    Napi::ThreadSafeFunction onResult;
    Napi::ThreadSafeFunction onError;
    bool disposed;
};

static std::map<int, SessionCallbacks> sessionCallbacks;
static std::mutex callbackMutex;

// C callback bridge for results
static void OnResultBridge(int sessionId, const char* text, bool isFinal) {
    std::lock_guard<std::mutex> lock(callbackMutex);
    auto it = sessionCallbacks.find(sessionId);
    if (it == sessionCallbacks.end() || it->second.disposed) {
        return;
    }
    
    std::string textStr(text ? text : "");
    bool finalCopy = isFinal;
    
    it->second.onResult.NonBlockingCall([sessionId, textStr, finalCopy](Napi::Env env, Napi::Function fn) {
        fn.Call({
            Napi::Number::New(env, sessionId),
            Napi::String::New(env, textStr),
            Napi::Boolean::New(env, finalCopy)
        });
    });
}

// C callback bridge for errors
static void OnErrorBridge(int sessionId, const char* error) {
    std::lock_guard<std::mutex> lock(callbackMutex);
    auto it = sessionCallbacks.find(sessionId);
    if (it == sessionCallbacks.end() || it->second.disposed) {
        return;
    }
    
    std::string errorStr(error ? error : "Unknown error");
    
    it->second.onError.NonBlockingCall([sessionId, errorStr](Napi::Env env, Napi::Function fn) {
        fn.Call({
            Napi::Number::New(env, sessionId),
            Napi::String::New(env, errorStr)
        });
    });
}

// N-API: Check if Apple Speech is available
static Napi::Value IsAvailable(const Napi::CallbackInfo& info) {
    return Napi::Boolean::New(info.Env(), appleSpeechIsAvailable());
}

// N-API: Create a new streaming session
static Napi::Value CreateSession(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 3) {
        Napi::TypeError::New(env, "Expected 3 arguments: locale, onResult, onError").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    if (!info[0].IsString() || !info[1].IsFunction() || !info[2].IsFunction()) {
        Napi::TypeError::New(env, "Expected (string, function, function)").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::string locale = info[0].As<Napi::String>().Utf8Value();
    Napi::Function onResultFn = info[1].As<Napi::Function>();
    Napi::Function onErrorFn = info[2].As<Napi::Function>();
    
    // Create session
    int sessionId = appleSpeechCreateSession(
        locale.c_str(),
        OnResultBridge,
        OnErrorBridge
    );
    
    if (sessionId < 0) {
        return Napi::Number::New(env, -1);
    }
    
    // Store callbacks
    SessionCallbacks cbs;
    cbs.onResult = Napi::ThreadSafeFunction::New(
        env, onResultFn, "AppleSpeechOnResult", 0, 1
    );
    cbs.onError = Napi::ThreadSafeFunction::New(
        env, onErrorFn, "AppleSpeechOnError", 0, 1
    );
    cbs.disposed = false;
    
    {
        std::lock_guard<std::mutex> lock(callbackMutex);
        sessionCallbacks[sessionId] = std::move(cbs);
    }
    
    return Napi::Number::New(env, sessionId);
}

// N-API: Append audio data to session
static Napi::Value AppendAudio(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 2) {
        Napi::TypeError::New(env, "Expected 2 arguments: sessionId, buffer").ThrowAsJavaScriptException();
        return Napi::Boolean::New(env, false);
    }
    
    if (!info[0].IsNumber() || !info[1].IsBuffer()) {
        Napi::TypeError::New(env, "Expected (number, Buffer)").ThrowAsJavaScriptException();
        return Napi::Boolean::New(env, false);
    }
    
    int sessionId = info[0].As<Napi::Number>().Int32Value();
    Napi::Buffer<uint8_t> buffer = info[1].As<Napi::Buffer<uint8_t>>();
    
    bool ok = appleSpeechAppendAudio(sessionId, buffer.Data(), static_cast<int>(buffer.Length()));
    return Napi::Boolean::New(env, ok);
}

// N-API: End audio input (triggers final result)
static Napi::Value EndSession(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Expected sessionId").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    int sessionId = info[0].As<Napi::Number>().Int32Value();
    appleSpeechEndSession(sessionId);
    return env.Undefined();
}

// N-API: Cancel session
static Napi::Value CancelSession(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Expected sessionId").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    int sessionId = info[0].As<Napi::Number>().Int32Value();
    appleSpeechCancelSession(sessionId);
    return env.Undefined();
}

// N-API: Dispose session and clean up
static Napi::Value DisposeSession(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Expected sessionId").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    
    int sessionId = info[0].As<Napi::Number>().Int32Value();
    
    // Dispose native session
    appleSpeechDisposeSession(sessionId);
    
    // Clean up callbacks
    {
        std::lock_guard<std::mutex> lock(callbackMutex);
        auto it = sessionCallbacks.find(sessionId);
        if (it != sessionCallbacks.end()) {
            it->second.disposed = true;
            it->second.onResult.Release();
            it->second.onError.Release();
            sessionCallbacks.erase(it);
        }
    }
    
    return env.Undefined();
}

static Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("isAvailable", Napi::Function::New(env, IsAvailable));
    exports.Set("createSession", Napi::Function::New(env, CreateSession));
    exports.Set("appendAudio", Napi::Function::New(env, AppendAudio));
    exports.Set("endSession", Napi::Function::New(env, EndSession));
    exports.Set("cancelSession", Napi::Function::New(env, CancelSession));
    exports.Set("disposeSession", Napi::Function::New(env, DisposeSession));
    return exports;
}

NODE_API_MODULE(simen_speech_recognizer, Init)

#else

// Stub for non-macOS platforms
static Napi::Object Init(Napi::Env env, Napi::Object exports) {
    return exports;
}

NODE_API_MODULE(simen_speech_recognizer, Init)

#endif
