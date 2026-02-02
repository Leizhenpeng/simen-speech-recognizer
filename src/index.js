/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Simen. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

let native = null;

function loadNative() {
    if (native !== null) {
        return native;
    }

    if (process.platform !== 'darwin') {
        native = false;
        return native;
    }

    // Try to load prebuilt binary first
    try {
        native = require('@simen-speech-recognizer/darwin-arm64');
        return native;
    } catch {
        // Prebuilt not available
    }

    // Try to load from build directory
    try {
        native = require('./native/build/Release/simen_speech_recognizer.node');
        return native;
    } catch {
        // Build not available
    }

    native = false;
    return native;
}

/**
 * Check if Apple Speech is available on this platform
 * @returns {boolean}
 */
function isAvailable() {
    const mod = loadNative();
    if (!mod) {
        return false;
    }
    return mod.isAvailable();
}

/**
 * Transcribe an audio file using Apple Speech Framework
 * @param {string} filePath - Path to audio file (WAV format)
 * @param {string} [locale='zh-CN'] - Locale for speech recognition
 * @param {number} [timeoutSeconds=60] - Timeout in seconds
 * @returns {{success: boolean, text: string, error?: string}}
 */
function transcribeFile(filePath, locale = 'zh-CN', timeoutSeconds = 60) {
    const mod = loadNative();
    if (!mod) {
        return { success: false, text: '', error: 'Apple Speech is only available on macOS' };
    }

    const result = mod.transcribeFile(filePath, locale, timeoutSeconds);
    if (!result) {
        return { success: false, text: '', error: 'Transcription failed' };
    }

    try {
        return JSON.parse(result);
    } catch {
        return { success: false, text: '', error: 'Failed to parse result' };
    }
}

module.exports = {
    isAvailable,
    transcribeFile
};
