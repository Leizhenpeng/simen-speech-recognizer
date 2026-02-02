/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Simen. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

#ifndef APPLE_SPEECH_H
#define APPLE_SPEECH_H

#ifdef __cplusplus
extern "C" {
#endif

char* appleSpeechTranscribeFile(const char* filePath, const char* locale, double timeoutSeconds);
void appleSpeechFreeString(char* ptr);
bool appleSpeechIsAvailable(void);

#ifdef __cplusplus
}
#endif

#endif // APPLE_SPEECH_H
