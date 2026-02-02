/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Simen. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

/**
 * Check if Apple Speech is available on this platform
 */
export function isAvailable(): boolean;

/**
 * Streaming session interface
 */
export interface Session {
    /** Session ID */
    readonly sessionId: number;
    
    /**
     * Append PCM16 audio data to the session
     * @param pcm16Buffer - Buffer containing 16kHz mono Int16 PCM audio data
     * @returns true if successful
     */
    appendAudio(pcm16Buffer: Buffer): boolean;
    
    /**
     * End audio input and wait for final result
     */
    end(): void;
    
    /**
     * Cancel the session without waiting for result
     */
    cancel(): void;
    
    /**
     * Dispose the session and release resources
     */
    dispose(): void;
}

/**
 * Create a new streaming speech recognition session
 * @param locale - Locale for speech recognition (e.g., 'zh-CN', 'en-US')
 * @param onResult - Callback for recognition results (text, isFinal)
 * @param onError - Callback for errors
 * @returns Session object or null if creation failed
 */
export function createSession(
    locale: string,
    onResult: (text: string, isFinal: boolean) => void,
    onError: (error: string) => void
): Session | null;
