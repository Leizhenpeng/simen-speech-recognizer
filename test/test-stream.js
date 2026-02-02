/*---------------------------------------------------------------------------------------------
 *  Test streaming Apple Speech API
 *--------------------------------------------------------------------------------------------*/

const { isAvailable, createSession } = require('../src/index.js');

console.log('Testing Apple Speech Streaming API...\n');

// Test 1: Check availability
console.log('1. Checking availability...');
const available = isAvailable();
console.log(`   isAvailable(): ${available}`);

if (!available) {
    console.log('\n❌ Apple Speech is not available on this platform');
    process.exit(1);
}

// Test 2: Create session
console.log('\n2. Creating streaming session...');
const session = createSession(
    'zh-CN',
    (text, isFinal) => {
        console.log(`   onResult: "${text}" (isFinal: ${isFinal})`);
        if (isFinal) {
            console.log('\n✅ Received final result');
            session.dispose();
            console.log('   Session disposed');
            process.exit(0);
        }
    },
    (error) => {
        console.log(`   onError: ${error}`);
    }
);

if (!session) {
    console.log('\n❌ Failed to create session');
    process.exit(1);
}

console.log(`   Session created with ID: ${session.sessionId}`);

// Test 3: Send some test audio (silence)
console.log('\n3. Sending test audio (1 second of silence)...');
const sampleRate = 16000;
const durationSec = 1;
const samples = sampleRate * durationSec;
const silenceBuffer = Buffer.alloc(samples * 2);  // 16-bit = 2 bytes per sample

const ok = session.appendAudio(silenceBuffer);
console.log(`   appendAudio() returned: ${ok}`);

// Test 4: End session
console.log('\n4. Ending session...');
session.end();
console.log('   end() called, waiting for final result...');

// Timeout after 10 seconds
setTimeout(() => {
    console.log('\n⚠️  Timeout waiting for result');
    session.dispose();
    process.exit(1);
}, 10000);
