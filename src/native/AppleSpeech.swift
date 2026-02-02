/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Simen. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import Foundation
import Speech
import AVFoundation

// MARK: - Session Class

class AppleSpeechSession {
    private let speechRecognizer: SFSpeechRecognizer
    private let request: SFSpeechAudioBufferRecognitionRequest
    private var recognitionTask: SFSpeechRecognitionTask?
    private let audioFormat: AVAudioFormat
    
    var onResult: ((String, Bool) -> Void)?
    var onError: ((String) -> Void)?
    
    init?(locale: String?) {
        // Use system default if locale is nil or empty
        let recognizer: SFSpeechRecognizer?
        if let loc = locale, !loc.isEmpty {
            recognizer = SFSpeechRecognizer(locale: Locale(identifier: loc))
        } else {
            recognizer = SFSpeechRecognizer()  // System default, auto language detection
        }
        
        guard let recognizer = recognizer, recognizer.isAvailable else {
            return nil
        }
        
        self.speechRecognizer = recognizer
        self.request = SFSpeechAudioBufferRecognitionRequest()
        self.request.shouldReportPartialResults = true
        self.request.taskHint = .dictation
        
        // 16kHz mono Int16 PCM format
        guard let format = AVAudioFormat(
            commonFormat: .pcmFormatInt16,
            sampleRate: 16000,
            channels: 1,
            interleaved: true
        ) else {
            return nil
        }
        self.audioFormat = format
    }
    
    func start() {
        recognitionTask = speechRecognizer.recognitionTask(with: request) { [weak self] result, error in
            guard let self = self else { return }
            
            if let error = error {
                self.onError?(error.localizedDescription)
                return
            }
            
            if let result = result {
                let text = result.bestTranscription.formattedString
                self.onResult?(text, result.isFinal)
            }
        }
    }
    
    func appendAudio(_ pcmData: Data) {
        let frameCount = pcmData.count / 2  // Int16 = 2 bytes per sample
        guard frameCount > 0 else { return }
        
        guard let buffer = AVAudioPCMBuffer(pcmFormat: audioFormat, frameCapacity: AVAudioFrameCount(frameCount)) else {
            return
        }
        
        buffer.frameLength = AVAudioFrameCount(frameCount)
        
        pcmData.withUnsafeBytes { rawPtr in
            guard let int16Ptr = rawPtr.baseAddress?.assumingMemoryBound(to: Int16.self),
                  let channelData = buffer.int16ChannelData else {
                return
            }
            channelData[0].update(from: int16Ptr, count: frameCount)
        }
        
        request.append(buffer)
    }
    
    func endAudio() {
        request.endAudio()
    }
    
    func cancel() {
        recognitionTask?.cancel()
        recognitionTask = nil
    }
}

// MARK: - Session Manager

private var sessions: [Int: AppleSpeechSession] = [:]
private var nextSessionId: Int = 1
private let sessionLock = NSLock()

// Store callbacks globally (C function pointers)
private var resultCallbacks: [Int: (Int, UnsafePointer<CChar>, Bool) -> Void] = [:]
private var errorCallbacks: [Int: (Int, UnsafePointer<CChar>) -> Void] = [:]

// MARK: - C Interface

@_cdecl("appleSpeechIsAvailable")
public func appleSpeechIsAvailable() -> Bool {
    guard let recognizer = SFSpeechRecognizer() else {
        return false
    }
    return recognizer.isAvailable
}

@_cdecl("appleSpeechCreateSession")
public func appleSpeechCreateSession(
    _ locale: UnsafePointer<CChar>?,
    _ onResult: @escaping @convention(c) (Int, UnsafePointer<CChar>, Bool) -> Void,
    _ onError: @escaping @convention(c) (Int, UnsafePointer<CChar>) -> Void
) -> Int {
    // Pass nil for system default, or specific locale string
    let loc: String? = locale != nil ? String(cString: locale!) : nil
    
    guard let session = AppleSpeechSession(locale: loc) else {
        return -1
    }
    
    sessionLock.lock()
    let sessionId = nextSessionId
    nextSessionId += 1
    sessions[sessionId] = session
    resultCallbacks[sessionId] = onResult
    errorCallbacks[sessionId] = onError
    sessionLock.unlock()
    
    session.onResult = { text, isFinal in
        text.withCString { cStr in
            onResult(sessionId, cStr, isFinal)
        }
    }
    
    session.onError = { error in
        error.withCString { cStr in
            onError(sessionId, cStr)
        }
    }
    
    session.start()
    return sessionId
}

@_cdecl("appleSpeechAppendAudio")
public func appleSpeechAppendAudio(
    _ sessionId: Int,
    _ data: UnsafePointer<UInt8>?,
    _ length: Int
) -> Bool {
    guard let data = data, length > 0 else {
        return false
    }
    
    sessionLock.lock()
    guard let session = sessions[sessionId] else {
        sessionLock.unlock()
        return false
    }
    sessionLock.unlock()
    
    let pcmData = Data(bytes: data, count: length)
    session.appendAudio(pcmData)
    return true
}

@_cdecl("appleSpeechEndSession")
public func appleSpeechEndSession(_ sessionId: Int) {
    sessionLock.lock()
    guard let session = sessions[sessionId] else {
        sessionLock.unlock()
        return
    }
    sessionLock.unlock()
    
    session.endAudio()
}

@_cdecl("appleSpeechCancelSession")
public func appleSpeechCancelSession(_ sessionId: Int) {
    sessionLock.lock()
    guard let session = sessions[sessionId] else {
        sessionLock.unlock()
        return
    }
    sessionLock.unlock()
    
    session.cancel()
}

@_cdecl("appleSpeechDisposeSession")
public func appleSpeechDisposeSession(_ sessionId: Int) {
    sessionLock.lock()
    if let session = sessions.removeValue(forKey: sessionId) {
        session.cancel()
    }
    resultCallbacks.removeValue(forKey: sessionId)
    errorCallbacks.removeValue(forKey: sessionId)
    sessionLock.unlock()
}
