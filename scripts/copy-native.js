#!/usr/bin/env node
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Simen. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const NATIVE_BUILD_DIR = path.join(ROOT, 'src', 'native', 'build', 'Release');
const PACKAGES_DIR = path.join(ROOT, 'packages');
const NODE_FILE_NAME = 'simen_speech_recognizer.node';

function copyNative(platform) {
	if (!platform) {
		console.error('❌ Usage: node scripts/copy-native.js <platform>');
		console.error('   Platforms: darwin-arm64');
		process.exit(1);
	}

	const srcFile = path.join(NATIVE_BUILD_DIR, NODE_FILE_NAME);
	const destDir = path.join(PACKAGES_DIR, platform);
	const destFile = path.join(destDir, NODE_FILE_NAME);

	// Check source file exists
	if (!fs.existsSync(srcFile)) {
		console.error(`❌ Source file not found: ${srcFile}`);
		console.error('   Run node-gyp rebuild first.');
		process.exit(1);
	}

	// Ensure destination directory exists
	if (!fs.existsSync(destDir)) {
		fs.mkdirSync(destDir, { recursive: true });
		console.log(`📁 Created directory: ${destDir}`);
	}

	// Copy file
	fs.copyFileSync(srcFile, destFile);

	// Get file info
	const stats = fs.statSync(destFile);
	const sizeKB = (stats.size / 1024).toFixed(1);

	console.log(`\n✅ Copied native module to ${platform}`);
	console.log(`   Source: ${srcFile}`);
	console.log(`   Dest:   ${destFile}`);
	console.log(`   Size:   ${sizeKB} KB`);
	console.log(`   Time:   ${stats.mtime.toISOString()}\n`);
}

const platform = process.argv[2];
copyNative(platform);
