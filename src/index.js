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
    if (!mod || !mod.isAvailable) {
        return false;
    }
    return mod.isAvailable();
}

/**
 * Create a new streaming speech recognition session
 * @param {string} locale - Locale for speech recognition
 * @param {(text: string, isFinal: boolean) => void} onResult - Result callback
 * @param {(error: string) => void} onError - Error callback
 * @returns {Session | null}
 */
function createSession(locale, onResult, onError) {
    const mod = loadNative();
    if (!mod || !mod.createSession) {
        return null;
    }

    // Pass locale as-is; empty string or null = system default
    const sessionId = mod.createSession(
        locale || '',
        (id, text, isFinal) => {
            if (onResult) {
                onResult(text, isFinal);
            }
        },
        (id, error) => {
            if (onError) {
                onError(error);
            }
        }
    );

    if (sessionId < 0) {
        return null;
    }

    // Return Session object
    return {
        sessionId,
        
        appendAudio(pcm16Buffer) {
            if (!mod.appendAudio) {
                return false;
            }
            return mod.appendAudio(sessionId, pcm16Buffer);
        },
        
        end() {
            if (mod.endSession) {
                mod.endSession(sessionId);
            }
        },
        
        cancel() {
            if (mod.cancelSession) {
                mod.cancelSession(sessionId);
            }
        },
        
        dispose() {
            if (mod.disposeSession) {
                mod.disposeSession(sessionId);
            }
        }
    };
}

module.exports = {
    isAvailable,
    createSession
};
