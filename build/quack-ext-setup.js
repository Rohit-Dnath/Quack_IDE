/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

/**
 * Setup script for quack-ext extension to ensure it's properly integrated into VS Code build
 */

function setupQuackExt() {
	console.log('Setting up quack-ext extension...');

	const extensionPath = path.join(__dirname, '..', '..', 'extensions', 'quack-ext');
	const distPath = path.join(extensionPath, 'dist');

	// Ensure dist directory exists
	if (!fs.existsSync(distPath)) {
		fs.mkdirSync(distPath, { recursive: true });
		console.log('Created dist directory for quack-ext');
	}

	// Check if proxy.py exists
	const proxyPath = path.join(extensionPath, 'proxy.py');
	if (!fs.existsSync(proxyPath)) {
		console.warn('Warning: proxy.py not found in quack-ext extension directory');
	} else {
		console.log('✓ proxy.py found');
	}

	// Check if TypeScript source exists
	const srcPath = path.join(extensionPath, 'src', 'extension.ts');
	if (!fs.existsSync(srcPath)) {
		console.error('Error: extension.ts not found in quack-ext/src/');
		return false;
	} else {
		console.log('✓ extension.ts found');
	}

	console.log('quack-ext setup completed successfully');
	return true;
}

function checkDependencies() {
	console.log('Checking quack-ext dependencies...');

	// Check if setup scripts exist
	const extensionPath = path.join(__dirname, '..', '..', 'extensions', 'quack-ext');
	const setupPy = path.join(extensionPath, 'setup_dependencies.py');
	const setupBat = path.join(extensionPath, 'setup_dependencies.bat');

	if (fs.existsSync(setupPy)) {
		console.log('✓ Python setup script available');
	}

	if (fs.existsSync(setupBat)) {
		console.log('✓ Windows batch setup script available');
	}

	console.log('Note: Run setup_dependencies.bat (Windows) or setup_dependencies.py to install Python dependencies');
	console.log('Required: pip install mitmproxy pytesseract');
}

if (require.main === module) {
	setupQuackExt();
	checkDependencies();
}

module.exports = { setupQuackExt, checkDependencies };
