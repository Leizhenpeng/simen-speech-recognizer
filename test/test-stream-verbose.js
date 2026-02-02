/*---------------------------------------------------------------------------------------------
 *  Test streaming Apple Speech API with verbose logging
 *--------------------------------------------------------------------------------------------*/

const { isAvailable, createSession } = require('../src/index.js');

console.log('Testing Apple Speech Streaming API (verbose)...\n');
console.log('Platform:', process.platform);
console.log('Node version:', process.version);

// Test availability
console.log('\n1. Checking availability...');
const available = isAvailable();
console.log(`   isAvailable(): ${available}`);

if (!available) {
    console.log('\n❌ Apple Speech is not available');
    process.exit(1);
}

// Create session
console.log('\n2. Creating session...');
let resultCount = 0;
let errorCount = 0;

const session = createSession(
    'zh-CN',
    (text, isFinal) => {
        resultCount++;
        console.log(`   [Result #${resultCount}] text="${text}", isFinal=${isFinal}`);
        if (isFinal) {
            console.log('\n✅ Got final result, cleaning up...');
            setTimeout(() => {
                session.dispose();
                console.log('   Disposed');
                process.exit(0);
            }, 100);
        }
    },
    (error) => {
        errorCount++;
        console.log(`   [Error #${errorCount}] ${error}`);
    }
);

if (!session) {
    console.log('❌ Failed to create session');
    process.exit(1);
}

console.log(`   Session ID: ${session.sessionId}`);

// Generate a simple sine wave tone (more likely to produce a result than silence)
console.log('\n3. Generating test audio (440Hz tone, 2 seconds)...');
const sampleRate = 16000;
const durationSec = 2;
const frequency = 440;
const samples = sampleRate * durationSec;
const buffer = Buffer.alloc(samples * 2);

for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const value = Math.sin(2 * Math.PI * frequency * t) * 0.3 * 32767;
    buffer.writeInt16LE(Math.round(value), i * 2);
}

console.log(`   Buffer size: ${buffer.length} bytes (${samples} samples)`);

// Send audio in chunks
console.log('\n4. Sending audio in chunks...');
const chunkSize = 3200;  // 100ms at 16kHz
let offset = 0;
let chunkCount = 0;

while (offset < buffer.length) {
    const chunk = buffer.slice(offset, Math.min(offset + chunkSize, buffer.length));
    const ok = session.appendAudio(chunk);
    chunkCount++;
    if (chunkCount <= 3 || chunkCount % 10 === 0) {
        console.log(`   Chunk ${chunkCount}: ${chunk.length} bytes, ok=${ok}`);
    }
    offset += chunkSize;
}

console.log(`   Total chunks sent: ${chunkCount}`);

// End session
console.log('\n5. Ending session...');
session.end();
console.log('   Waiting for results...');
console.log('   (Note: A tone may not produce speech results, this tests the API flow)');

// Timeout
setTimeout(() => {
    console.log(`\n⏱️  Timeout after 15 seconds`);
    console.log(`   Results received: ${resultCount}`);
    console.log(`   Errors received: ${errorCount}`);
    
    if (resultCount === 0 && errorCount === 0) {
        console.log('\n⚠️  No callbacks received - this might be expected for non-speech audio');
        console.log('   The API is functional, Speech Framework may just not recognize the tone');
    }
    
    session.dispose();
    process.exit(resultCount > 0 || errorCount > 0 ? 0 : 1);
}, 15000);
