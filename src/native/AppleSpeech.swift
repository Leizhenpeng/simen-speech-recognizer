/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Simen. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import Foundation
import Speech

// MARK: - Result Structure

struct TranscriptionResult: Codable {
    let success: Bool
    let text: String
    let error: String?
}

// MARK: - Internal Helpers

private func encodeResult(_ result: TranscriptionResult) -> String {
    let encoder = JSONEncoder()
    guard let data = try? encoder.encode(result),
          let json = String(data: data, encoding: .utf8) else {
        return "{\"success\":false,\"text\":\"\",\"error\":\"JSON encoding failed\"}"
    }
    return json
}

private func errorResult(_ message: String) -> String {
    return encodeResult(TranscriptionResult(success: false, text: "", error: message))
}

private func successResult(_ text: String) -> String {
    return encodeResult(TranscriptionResult(success: true, text: text, error: nil))
}

// MARK: - Synchronous Transcription

private func transcribeSync(fileURL: URL, locale: String, timeoutSeconds: Double) -> String {
    guard let speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: locale)) else {
        return errorResult("Failed to create speech recognizer for locale: \(locale)")
    }

    guard speechRecognizer.isAvailable else {
        return errorResult("Speech recognizer is not available")
    }

    let request = SFSpeechURLRecognitionRequest(url: fileURL)
    request.shouldReportPartialResults = false
    request.taskHint = .dictation
    request.requiresOnDeviceRecognition = false

    let semaphore = DispatchSemaphore(value: 0)
    var resultText: String = ""
    var resultError: String? = nil

    speechRecognizer.recognitionTask(with: request) { result, error in
        if let error = error {
            resultError = error.localizedDescription
            semaphore.signal()
            return
        }
        if let result = result, result.isFinal {
            resultText = result.bestTranscription.formattedString
            semaphore.signal()
        }
    }

    let timeout = DispatchTime.now() + timeoutSeconds
    if semaphore.wait(timeout: timeout) == .timedOut {
        return errorResult("Transcription timed out")
    }

    if let error = resultError {
        return errorResult(error)
    }

    return successResult(resultText)
}

// MARK: - C Interface

@_cdecl("appleSpeechTranscribeFile")
public func appleSpeechTranscribeFile(
    _ filePath: UnsafePointer<CChar>?,
    _ locale: UnsafePointer<CChar>?,
    _ timeoutSeconds: Double
) -> UnsafeMutablePointer<CChar>? {
    guard let filePath = filePath else {
        return strdup(errorResult("File path is nil"))
    }

    let path = String(cString: filePath)
    let loc = locale != nil ? String(cString: locale!) : "zh-CN"
    let timeout = timeoutSeconds > 0 ? timeoutSeconds : 60.0

    let fileURL = URL(fileURLWithPath: path)

    guard FileManager.default.fileExists(atPath: path) else {
        return strdup(errorResult("File not found: \(path)"))
    }

    let result = transcribeSync(fileURL: fileURL, locale: loc, timeoutSeconds: timeout)
    return strdup(result)
}

@_cdecl("appleSpeechFreeString")
public func appleSpeechFreeString(_ ptr: UnsafeMutablePointer<CChar>?) {
    if let ptr = ptr {
        free(ptr)
    }
}

@_cdecl("appleSpeechIsAvailable")
public func appleSpeechIsAvailable() -> Bool {
    guard let recognizer = SFSpeechRecognizer() else {
        return false
    }
    return recognizer.isAvailable
}
