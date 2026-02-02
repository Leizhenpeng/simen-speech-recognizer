/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Simen. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

export interface TranscriptionResult {
    success: boolean;
    text: string;
    error?: string;
}

/**
 * Check if Apple Speech is available on this platform
 */
export function isAvailable(): boolean;

/**
 * Transcribe an audio file using Apple Speech Framework
 * @param filePath - Path to audio file (WAV format)
 * @param locale - Locale for speech recognition (default: 'zh-CN')
 * @param timeoutSeconds - Timeout in seconds (default: 60)
 */
export function transcribeFile(
    filePath: string,
    locale?: string,
    timeoutSeconds?: number
): TranscriptionResult;
