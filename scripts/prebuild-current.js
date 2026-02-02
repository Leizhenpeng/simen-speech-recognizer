#!/usr/bin/env node
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Simen. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Detect current platform
const platform = process.platform;
const arch = process.arch;
const platformArch = `${platform}-${arch}`;

// Supported platforms (Apple Speech is macOS only)
const SUPPORTED = {
	'darwin-arm64': {
		name: 'macOS ARM64',
		needsSwift: true,
	},
};

function run(cmd, options = {}) {
	console.log(`\n$ ${cmd}\n`);
	execSync(cmd, { stdio: 'inherit', cwd: ROOT, ...options });
}

function main() {
	console.log(`\n🔧 Prebuild for current platform`);
	console.log(`   Platform: ${platformArch}`);

	const config = SUPPORTED[platformArch];
	if (!config) {
		console.log(`\n⚠️  Skipping prebuild: Apple Speech is only available on macOS ARM64`);
		console.log(`   Current platform: ${platformArch}`);
		console.log(`   Supported: ${Object.keys(SUPPORTED).join(', ')}`);
		process.exit(0);
	}

	console.log(`   Name: ${config.name}`);

	try {
		// Step 1: Build Swift
		console.log(`\n📦 Step 1/4: Building Swift module...`);
		run('npm run build:swift');

		// Step 2: Install native dependencies
		console.log(`\n📦 Step 2/4: Installing native dependencies...`);
		run('npm install', { cwd: path.join(ROOT, 'src', 'native') });

		// Step 3: Build native module
		console.log(`\n📦 Step 3/4: Building native module...`);
		run('npx node-gyp rebuild', { cwd: path.join(ROOT, 'src', 'native') });

		// Step 4: Copy to packages directory
		console.log(`\n📦 Step 4/4: Copying to packages/${platformArch}...`);
		run(`node scripts/copy-native.js ${platformArch}`);

		console.log(`\n✅ Prebuild complete for ${config.name}!\n`);

	} catch (error) {
		console.error(`\n❌ Prebuild failed:`, error.message);
		process.exit(1);
	}
}

main();
