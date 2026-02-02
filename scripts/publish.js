#!/usr/bin/env node
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Simen. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PACKAGES_DIR = path.join(ROOT, 'packages');

// Platform detection
const CURRENT_PLATFORM = process.platform;
const CURRENT_ARCH = process.arch;
const CURRENT_PLATFORM_ARCH = `${CURRENT_PLATFORM}-${CURRENT_ARCH}`;

// Supported platforms (Apple Speech is macOS only)
const PLATFORMS = [
	'darwin-arm64',
];

// Platform-specific build commands
const BUILD_COMMANDS = {
	'darwin-arm64': 'npm run prebuild:mac',
};

function getVersion() {
	const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
	return pkg.version;
}

function syncVersions(version) {
	console.log(`\n📦 Syncing version ${version} to all packages...\n`);

	for (const platform of PLATFORMS) {
		const pkgPath = path.join(PACKAGES_DIR, platform, 'package.json');
		if (fs.existsSync(pkgPath)) {
			const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
			pkg.version = version;
			fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
			console.log(`  ✓ ${platform}: ${version}`);
		}
	}

	// Also update optionalDependencies in main package.json
	const mainPkgPath = path.join(ROOT, 'package.json');
	const mainPkg = JSON.parse(fs.readFileSync(mainPkgPath, 'utf8'));
	if (mainPkg.optionalDependencies) {
		for (const platform of PLATFORMS) {
			const depName = `@simen-speech-recognizer/${platform}`;
			if (mainPkg.optionalDependencies[depName]) {
				mainPkg.optionalDependencies[depName] = version;
			}
		}
		fs.writeFileSync(mainPkgPath, JSON.stringify(mainPkg, null, 2) + '\n');
		console.log(`  ✓ main package optionalDependencies updated`);
	}
}

function getNodeFileStats(platform) {
	const nodeFile = path.join(PACKAGES_DIR, platform, 'simen_speech_recognizer.node');
	if (!fs.existsSync(nodeFile)) {
		return null;
	}
	const stats = fs.statSync(nodeFile);
	return {
		path: nodeFile,
		size: stats.size,
		mtime: stats.mtime,
	};
}

function buildNativeModule(platform, skipBuild = false) {
	const buildCmd = BUILD_COMMANDS[platform];
	if (!buildCmd) {
		console.log(`  ⚠ No build command for ${platform}`);
		return false;
	}

	// Check if we can build for this platform
	if (platform !== CURRENT_PLATFORM_ARCH) {
		console.log(`  ⚠ Cannot build ${platform} on ${CURRENT_PLATFORM_ARCH} (cross-compilation not supported)`);
		return false;
	}

	if (skipBuild) {
		console.log(`  ⏭ Skipping build for ${platform} (--skip-build)`);
		return true;
	}

	console.log(`  🔨 Building native module for ${platform}...`);
	try {
		execSync(buildCmd, {
			cwd: ROOT,
			stdio: 'inherit',
		});
		console.log(`  ✓ Build successful for ${platform}`);
		return true;
	} catch (err) {
		console.error(`  ✗ Build failed for ${platform}:`, err.message);
		return false;
	}
}

function getNodeFileHash(filePath) {
	const crypto = require('crypto');
	const content = fs.readFileSync(filePath);
	return crypto.createHash('sha256').update(content).digest('hex').substring(0, 12);
}

function checkNodeFiles() {
	console.log(`\n📋 Checking .node files in platform packages...\n`);

	const results = {};
	for (const platform of PLATFORMS) {
		const stats = getNodeFileStats(platform);
		if (stats) {
			const sizeKB = (stats.size / 1024).toFixed(1);
			const timeStr = stats.mtime.toISOString();
			const hash = getNodeFileHash(stats.path);
			console.log(`  ✓ ${platform}: ${sizeKB} KB, modified ${timeStr}, hash ${hash}`);
			results[platform] = { ...stats, hash };
		} else {
			console.log(`  ✗ ${platform}: .node file missing`);
			results[platform] = null;
		}
	}
	return results;
}

function publishPackages(dryRun = false, platformsToPublish = null) {
	const dryRunFlag = dryRun ? '--dry-run' : '';
	const platforms = platformsToPublish || PLATFORMS;

	console.log(`\n🚀 Publishing packages${dryRun ? ' (dry-run)' : ''}...\n`);

	// Publish platform packages first
	for (const platform of platforms) {
		const pkgDir = path.join(PACKAGES_DIR, platform);
		const nodeFile = path.join(pkgDir, 'simen_speech_recognizer.node');

		if (!fs.existsSync(nodeFile)) {
			console.log(`  ⚠ Skipping ${platform}: .node file not found`);
			continue;
		}

		try {
			console.log(`  Publishing @simen-speech-recognizer/${platform}...`);
			execSync(`npm publish --access public ${dryRunFlag}`, {
				cwd: pkgDir,
				stdio: 'inherit',
			});
			console.log(`  ✓ @simen-speech-recognizer/${platform} published`);
		} catch (err) {
			console.error(`  ✗ Failed to publish ${platform}:`, err.message);
			if (!dryRun) process.exit(1);
		}
	}

	// Publish main package
	try {
		console.log(`\n  Publishing simen-speech-recognizer (main)...`);
		execSync(`npm publish --access public ${dryRunFlag}`, {
			cwd: ROOT,
			stdio: 'inherit',
		});
		console.log(`  ✓ simen-speech-recognizer published`);
	} catch (err) {
		console.error(`  ✗ Failed to publish main package:`, err.message);
		if (!dryRun) process.exit(1);
	}
}

function printHelp() {
	console.log(`
Usage: node scripts/publish.js [options]

Options:
  --dry-run       Run npm publish with --dry-run flag
  --skip-build    Skip native module build (use existing .node files)
  --sync-only     Only sync version numbers, don't build or publish
  --check-only    Only check .node files status
  --help          Show this help message

Current platform: ${CURRENT_PLATFORM_ARCH}
Supported platforms: ${PLATFORMS.join(', ')}

Examples:
  node scripts/publish.js                    # Full build + publish
  node scripts/publish.js --dry-run          # Test publish without actually publishing
  node scripts/publish.js --skip-build       # Publish using existing .node files
  node scripts/publish.js --sync-only        # Only sync version numbers
  node scripts/publish.js --check-only       # Only check .node file status
`);
}

async function main() {
	const args = process.argv.slice(2);

	// Parse arguments
	const dryRun = args.includes('--dry-run');
	const skipBuild = args.includes('--skip-build');
	const syncOnly = args.includes('--sync-only');
	const checkOnly = args.includes('--check-only');
	const showHelp = args.includes('--help') || args.includes('-h');

	if (showHelp) {
		printHelp();
		return;
	}

	const version = getVersion();
	console.log(`\n🔧 simen-speech-recognizer publish script`);
	console.log(`   Version: ${version}`);
	console.log(`   Current platform: ${CURRENT_PLATFORM_ARCH}`);
	console.log(`   Supported platforms: ${PLATFORMS.join(', ')}`);

	// Check if current platform is supported
	if (!PLATFORMS.includes(CURRENT_PLATFORM_ARCH)) {
		console.log(`\n⚠️  Current platform (${CURRENT_PLATFORM_ARCH}) is not supported.`);
		console.log(`   Apple Speech is only available on macOS ARM64.`);

		if (checkOnly) {
			checkNodeFiles();
			return;
		}

		if (syncOnly) {
			syncVersions(version);
			return;
		}

		console.log(`   Use --skip-build to publish existing .node files.`);
		if (!skipBuild) {
			process.exit(1);
		}
	}

	if (checkOnly) {
		checkNodeFiles();
		return;
	}

	if (syncOnly) {
		syncVersions(version);
		return;
	}

	// Step 1: Sync versions
	syncVersions(version);

	// Step 2: Build native module (unless skipped)
	if (!skipBuild && PLATFORMS.includes(CURRENT_PLATFORM_ARCH)) {
		console.log(`\n🔨 Building native modules...\n`);
		buildNativeModule(CURRENT_PLATFORM_ARCH, skipBuild);
	}

	// Step 3: Check all .node files
	const nodeFileStatus = checkNodeFiles();

	// Verify platform has .node file
	const hasNodeFile = PLATFORMS.some(p => nodeFileStatus[p] !== null);
	if (!hasNodeFile) {
		console.error('\n❌ No .node files found. Cannot publish.');
		console.error('   Run prebuild first or use --skip-build with existing files.');
		process.exit(1);
	}

	// Step 4: Determine which platforms can be published
	const publishablePlatforms = PLATFORMS.filter(p => nodeFileStatus[p] !== null);

	// Step 5: Publish
	publishPackages(dryRun, publishablePlatforms);

	console.log(`\n✅ Done!\n`);
}

main().catch(err => {
	console.error('Error:', err.message);
	process.exit(1);
});
