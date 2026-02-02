/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Simen. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

#include <napi.h>
#include <string>
#include "apple_speech.h"

#if defined(__APPLE__)

static Napi::Value TranscribeFile(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "File path string expected").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::string filePath = info[0].As<Napi::String>().Utf8Value();
    std::string locale = "zh-CN";
    double timeout = 60.0;

    if (info.Length() >= 2 && info[1].IsString()) {
        locale = info[1].As<Napi::String>().Utf8Value();
    }

    if (info.Length() >= 3 && info[2].IsNumber()) {
        timeout = info[2].As<Napi::Number>().DoubleValue();
    }

    char* result = appleSpeechTranscribeFile(filePath.c_str(), locale.c_str(), timeout);
    if (!result) {
        return env.Null();
    }

    std::string json(result);
    appleSpeechFreeString(result);

    return Napi::String::New(env, json);
}

static Napi::Value IsAvailable(const Napi::CallbackInfo& info) {
    return Napi::Boolean::New(info.Env(), appleSpeechIsAvailable());
}

static Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("transcribeFile", Napi::Function::New(env, TranscribeFile));
    exports.Set("isAvailable", Napi::Function::New(env, IsAvailable));
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
