/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Simen. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

#pragma once

#ifdef __cplusplus
extern "C" {
#endif

#include <stdbool.h>
#include <stdint.h>

// Callback types
typedef void (*AppleSpeechResultCallback)(int sessionId, const char* text, bool isFinal);
typedef void (*AppleSpeechErrorCallback)(int sessionId, const char* error);

// API functions
bool appleSpeechIsAvailable(void);

int appleSpeechCreateSession(
    const char* locale,
    AppleSpeechResultCallback onResult,
    AppleSpeechErrorCallback onError
);

bool appleSpeechAppendAudio(int sessionId, const uint8_t* data, int length);

void appleSpeechEndSession(int sessionId);

void appleSpeechCancelSession(int sessionId);

void appleSpeechDisposeSession(int sessionId);

#ifdef __cplusplus
}
#endif
