import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as net from 'net';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
// @ts-ignore
import * as CryptoJS from 'crypto-js';
import fetch from 'node-fetch';

let protectionActive = false;
let statusBarItem: vscode.StatusBarItem | undefined;
let mitmProcess: ChildProcessWithoutNullStreams | undefined;
let companySnippets: string[] = [];

const WHITELIST_FILENAME = 'whitelist.json';

function getWhitelistPath(context: vscode.ExtensionContext): string {
	return path.join(context.globalStoragePath, WHITELIST_FILENAME);
}
function loadWhitelist(context: vscode.ExtensionContext): string[] {
	const filePath = getWhitelistPath(context);
	if (fs.existsSync(filePath)) {
		try {
			return JSON.parse(fs.readFileSync(filePath, 'utf8'));
		} catch {
			return [];
		}
	}
	return ["github.com", "chatgpt.com", "notion.so"];
}
function saveWhitelist(context: vscode.ExtensionContext, whitelist: string[]) {
	const filePath = getWhitelistPath(context);
	fs.mkdirSync(context.globalStoragePath, { recursive: true });
	fs.writeFileSync(filePath, JSON.stringify(whitelist, null, 2), 'utf8');
}
async function updateProxyWhitelist(whitelist: string[]) {
	try {
		await fetch('http://localhost:8000/whitelist', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ whitelist }),
		});
	} catch {
		vscode.window.showWarningMessage('Could not update quack-ext proxy whitelist.');
	}
}
async function manageWhitelist(context: vscode.ExtensionContext) {
	let whitelist = loadWhitelist(context);
	while (true) {
		const choice = await vscode.window.showQuickPick(
			[
				...whitelist.map(url => `❌ Remove: ${url}`),
				'➕ Add new URL',
				'✔️ Done'
			],
			{ placeHolder: 'quack-ext: Manage Whitelisted URLs' }
		);
		if (!choice || choice === '✔️ Done') { break; }
		if (choice.startsWith('❌ Remove: ')) {
			const url = choice.replace('❌ Remove: ', '');
			whitelist = whitelist.filter(u => u !== url);
		} else if (choice === '➕ Add new URL') {
			const input = await vscode.window.showInputBox({ prompt: 'Enter new whitelisted URL/domain (e.g. github.com)' });
			if (input && !whitelist.includes(input)) {
				whitelist.push(input);
			}
		}
	}
	saveWhitelist(context, whitelist);
	await updateProxyWhitelist(whitelist);
	// Optional: wipe clipboard to be ultra-safe, not strictly needed
	await vscode.env.clipboard.writeText('');
	vscode.window.showInformationMessage('Whitelist updated! All outbound pastes to removed sites are now blocked.');
}
async function showWhitelist(context: vscode.ExtensionContext) {
	const whitelist = loadWhitelist(context);
	if (whitelist.length === 0) {
		vscode.window.showInformationMessage('No whitelisted URLs set.');
	} else {
		vscode.window.showQuickPick(whitelist, { canPickMany: false, placeHolder: 'quack-ext: Whitelisted URLs' });
	}
}

// --- Keepalive logic ---
let pingInterval: NodeJS.Timeout | undefined;
function startProxyPing() {
	if (pingInterval) { return; }
	pingInterval = setInterval(() => {
		fetch('http://localhost:8000/keepalive').catch(() => { });
	}, 30000); // every 30 seconds
}
function stopProxyPing() {
	if (pingInterval) {
		clearInterval(pingInterval);
		pingInterval = undefined;
	}
}

const ENCRYPTION_KEY = 'quack-ext_secret_key_hackathon';
const ENCRYPTED_TAG = '--quack-ext_ENCRYPTED--\n';

async function checkMitmProxy(): Promise<boolean> {
	return new Promise((resolve) => {
		const client = net.createConnection({ port: 8000 }, () => {
			client.end();
			resolve(true);
		});
		client.on('error', () => resolve(false));
	});
}
function startMitmProxy(context: vscode.ExtensionContext): ChildProcessWithoutNullStreams {
	const mitmProxyPath = context.asAbsolutePath('mitmproxy.py');
	const process = spawn('python', [mitmProxyPath], { detached: true });

	process.on('error', (err) => {
		vscode.window.showErrorMessage('MITM proxy process failed: ' + err.message);
	});
	process.stderr.on('data', (data) => {
		vscode.window.showErrorMessage('MITM proxy stderr: ' + data.toString());
	});

	return process;
}
function getCodebaseSnippets(folderPath: string): string[] {
	let codeSnippets: string[] = [];
	function traverse(dir: string) {
		fs.readdirSync(dir).forEach(file => {
			const fullPath = path.join(dir, file);
			if (fs.statSync(fullPath).isDirectory()) {
				traverse(fullPath);
			} else if (/\.(js|ts|py|java|cpp|c|go|rb|php|cs)$/.test(file)) {
				const content = fs.readFileSync(fullPath, 'utf8');
				codeSnippets.push(...content.split('\n').filter(line => line.trim().length > 20));
			}
		});
	}
	traverse(folderPath);
	return codeSnippets;
}
async function sendCodebaseToProxy(folderPath: string) {
	companySnippets = getCodebaseSnippets(folderPath);
	try {
		await fetch('http://localhost:8000/init', {
			method: 'POST',
			body: JSON.stringify({ codeSnippets: companySnippets }),
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (err) {
		vscode.window.showWarningMessage('Could not send codebase snippets to quack-ext MITM proxy.');
	}
}
function isProtectedCode(text: string): boolean {
	for (const snippet of companySnippets) {
		if (text.includes(snippet.trim()) && snippet.trim().length > 15) {
			return true;
		}
	}
	return false;
}

// ---- ENCRYPTION HELPERS ----
function encryptText(plainText: string): string {
	return ENCRYPTED_TAG + CryptoJS.AES.encrypt(plainText, ENCRYPTION_KEY).toString();
}
function decryptText(cipherText: string): string {
	try {
		if (!cipherText.startsWith(ENCRYPTED_TAG)) { return ''; }
		const encryptedPart = cipherText.replace(ENCRYPTED_TAG, '');
		const bytes = CryptoJS.AES.decrypt(encryptedPart, ENCRYPTION_KEY);
		return bytes.toString(CryptoJS.enc.Utf8);
	} catch (err) {
		return '';
	}
}

// Secure copy/cut (encrypted!)
// Secure copy/cut (encrypted!) with .env block
async function secureCopyCut(isCut: boolean = false) {
	const editor = vscode.window.activeTextEditor;
	if (!editor || editor.selection.isEmpty) {
		// If no selection, fall back to default behavior
		if (isCut) {
			await vscode.commands.executeCommand('editor.action.clipboardCutAction');
		} else {
			await vscode.commands.executeCommand('editor.action.clipboardCopyAction');
		}
		return;
	}

	const fileName = path.basename(editor.document.fileName);
	if (fileName === '.env') {
		vscode.window.showWarningMessage('quack-ext: Copying from .env files is not allowed.');
		await vscode.env.clipboard.writeText(''); // Optional: wipe clipboard for safety
		return;
	}

	const selectedText = editor.document.getText(editor.selection);

	// Always encrypt if protection is active and we have company snippets
	if (protectionActive && isProtectedCode(selectedText)) {
		const encrypted = encryptText(selectedText);
		await vscode.env.clipboard.writeText(encrypted);
		vscode.window.setStatusBarMessage('🔒 quack-ext: Protected code copied (encrypted!)', 3000);
	} else {
		// For non-protected code, copy normally
		// await vscode.env.clipboard.writeText(selectedText);
		// if (protectionActive) {
		// 	vscode.window.setStatusBarMessage('📋 quack-ext: Code copied normally', 2000);
		// }
		const encrypted = encryptText(selectedText);
		await vscode.env.clipboard.writeText(encrypted);
		vscode.window.setStatusBarMessage('🔒 quack-ext: Protected code copied (encrypted!)', 3000);

	}

	if (isCut) {
		editor.edit(editBuilder => {
			editBuilder.delete(editor.selection);
		});
	}
}

// Secure paste (decrypt if needed)
async function securePaste() {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		// If no editor, fall back to default paste
		await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
		return;
	}

	const clipboardText = await vscode.env.clipboard.readText();

	if (clipboardText.startsWith(ENCRYPTED_TAG)) {
		// This is encrypted content
		if (
			vscode.workspace.workspaceFolders &&
			editor.document.uri.fsPath.startsWith(vscode.workspace.workspaceFolders[0].uri.fsPath)
		) {
			// We're inside the workspace, decrypt and paste
			const decrypted = decryptText(clipboardText);
			if (decrypted) {
				editor.edit(editBuilder => {
					editBuilder.insert(editor.selection.active, decrypted);
				});
				vscode.window.setStatusBarMessage('🔓 quack-ext: Protected code pasted (decrypted)', 3000);
			} else {
				vscode.window.showWarningMessage('quack-ext: Could not decrypt clipboard content.');
			}
		} else {
			// We're outside the workspace, block the paste
			vscode.window.showWarningMessage('🚫 quack-ext: Cannot paste company code outside the codebase!');
			await vscode.env.clipboard.writeText('');
		}
	} else {
		// Normal clipboard content, paste normally
		editor.edit(editBuilder => {
			editBuilder.insert(editor.selection.active, clipboardText);
		});
		if (protectionActive && clipboardText.trim().length > 0) {
			vscode.window.setStatusBarMessage('📋 quack-ext: Normal paste completed', 2000);
		}
	}
}
// On blur, clear protected clipboard
async function clearProtectedClipboardOnBlur() {
	const clipboardText = await vscode.env.clipboard.readText();
	if (clipboardText.startsWith(ENCRYPTED_TAG)) {
		await vscode.env.clipboard.writeText('');
		vscode.window.setStatusBarMessage('quack-ext: Clipboard wiped (window blurred)', 2000);
	}
}

// --- Extension Security Watchdog ---
const trustedPublishers = ['ms-vscode', 'Microsoft', 'GitHub', 'ms-toolsai'];

function analyzeExtensionBehavior(ext: vscode.Extension<any>): string[] {
	const sus = [];
	const manifest = ext.packageJSON;
	if (!trustedPublishers.includes(manifest.publisher)) {
		sus.push('Publisher not trusted');
	}
	if (manifest.main) {
		sus.push('Has main entrypoint');
	}
	if (manifest.activationEvents) {
		if (manifest.activationEvents.some((e: string) =>
			e === '*' || e.toLowerCase().includes('startup') || e.toLowerCase().includes('command')
		)) {
			sus.push('Uses suspicious activation events');
		}
	}
	if (manifest.contributes) {
		if (manifest.contributes.debuggers) { sus.push('Declares custom debuggers'); }
		if (manifest.contributes.terminal) { sus.push('Declares custom terminal'); }
		if (manifest.contributes.authentication) { sus.push('Declares custom authentication'); }
		if (manifest.contributes.commands) {
			const susCommands = manifest.contributes.commands.filter(
				(c: any) => /run|exec|shell|sync|fetch|send|clipboard|upload/i.test(c.command)
			);
			if (susCommands.length > 0) {
				sus.push('Has suspicious commands');
			}
		}
	}
	if (manifest.scripts) {
		sus.push('Has scripts section');
	}
	return sus;
}

function scanAllExtensionsForBehavior() {
	vscode.extensions.all.forEach(ext => {
		const reasons = analyzeExtensionBehavior(ext);
		if (reasons.length > 0) {
			vscode.window.showWarningMessage(
				`🛡️ quack-ext Security: Extension "${ext.id}" flagged: ${reasons.join(', ')}.`,
				'Show Details', 'Ignore'
			).then(choice => {
				if (choice === 'Show Details') {
					vscode.commands.executeCommand('workbench.view.extensions').then(() => {
						vscode.commands.executeCommand('workbench.extensions.search', `@id:${ext.id}`);
					});
				}
			});
		}
	});
}

// --- Main security activation ---
function activateProtection(context: vscode.ExtensionContext) {
	if (protectionActive) {
		vscode.window.showInformationMessage('quack-ext Security is already active.');
		return;
	}
	protectionActive = true;

	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.text = '🦢 quack-ext: ON';
	statusBarItem.tooltip = 'quack-ext Security is active';
	statusBarItem.show();

	checkMitmProxy().then((running) => {
		if (!running) {
			vscode.window.showWarningMessage('quack-ext MITM Proxy not detected. Attempting to start...');
			mitmProcess = startMitmProxy(context);
			setTimeout(() => {
				checkMitmProxy().then((runningAfter) => {
					if (runningAfter) {
						vscode.window.showInformationMessage('quack-ext MITM Proxy started.');
					} else {
						vscode.window.showErrorMessage('quack-ext MITM Proxy could not be started. Code is not protected.');
					}
				});
			}, 3000);
		} else {
			vscode.window.showInformationMessage('quack-ext MITM Proxy detected. All company code leaks are protected!');
		}
	});

	if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
		const folderPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
		sendCodebaseToProxy(folderPath);
	}

	vscode.window.showInformationMessage('quack-ext Security is now active!');

	vscode.window.onDidChangeWindowState(async (e) => {
		if (!e.focused) {
			await clearProtectedClipboardOnBlur();
		}
	});

	startProxyPing();
	scanAllExtensionsForBehavior();
}

// --- Dependency Installation ---
async function installDependencies() {
	const terminal = vscode.window.createTerminal('Quack-Ext Setup');
	terminal.show();

	vscode.window.showInformationMessage('Installing quack-ext dependencies...');

	// Install mitmproxy and pytesseract
	terminal.sendText('pip install mitmproxy pytesseract');

	vscode.window.showInformationMessage('Quack-Ext dependencies installation started. Check terminal for progress.');
}

// --- Auto-start proxy server ---
function getProxyCommand(): string {
	// Use the specific mitmproxy path mentioned by the user
	return 'C:\\Users\\rohit\\AppData\\Roaming\\Python\\Python313\\Scripts\\mitmproxy.exe';
}

async function autoStartProxyServer(context: vscode.ExtensionContext) {
	try {
		// Check if proxy is already running
		const isRunning = await checkMitmProxy();
		if (isRunning) {
			vscode.window.showInformationMessage('Quack-Ext: Proxy server already running');
			return;
		}

		const proxyPath = context.asAbsolutePath('proxy.py');
		const mitmproxyCmd = getProxyCommand();

		// Check if mitmproxy exists
		if (!fs.existsSync(mitmproxyCmd)) {
			vscode.window.showWarningMessage('Quack-Ext: mitmproxy not found. Please install dependencies first.');
			return;
		}

		// Start the proxy server
		const process = spawn(mitmproxyCmd, ['-s', proxyPath, '--listen-port', '8000'], {
			detached: true,
			stdio: 'pipe'
		});

		mitmProcess = process;

		process.on('error', (err) => {
			vscode.window.showErrorMessage('Quack-Ext: Failed to start proxy server: ' + err.message);
		});

		process.stderr.on('data', (data) => {
			console.error('Quack-Ext proxy stderr:', data.toString());
		});

		vscode.window.showInformationMessage('Quack-Ext: Proxy server started successfully');

		// Auto-activate security once proxy is running
		setTimeout(() => {
			activateProtection(context);
		}, 2000);

	} catch (error) {
		vscode.window.showErrorMessage('Quack-Ext: Error starting proxy server: ' + error);
	}
}

export function activate(context: vscode.ExtensionContext) {
	console.log('Quack-Ext extension is being activated!');
	vscode.window.showInformationMessage('Quack-Ext extension activated successfully!');

	// Register commands ONCE here:
	context.subscriptions.push(
		vscode.commands.registerCommand('quack-ext.installDependencies', () => {
			installDependencies();
		}),
		vscode.commands.registerCommand('quack-ext.activateSecurity', () => {
			activateProtection(context);
		}),
		vscode.commands.registerCommand('quack-ext.manageWhitelist', () => manageWhitelist(context)),
		vscode.commands.registerCommand('quack-ext.showWhitelist', () => showWhitelist(context)),
		vscode.commands.registerCommand('quack-ext.scanExtensionSecurity', () => {
			vscode.window.showInformationMessage('quack-ext: Scanning extensions for suspicious background activity...');
			scanAllExtensionsForBehavior();
		}),
		// Register secure copy/paste commands immediately so keybindings work
		vscode.commands.registerCommand('quack-ext.secureCopy', () => secureCopyCut(false)),
		vscode.commands.registerCommand('quack-ext.secureCut', () => secureCopyCut(true)),
		vscode.commands.registerCommand('quack-ext.securePaste', () => securePaste())
	);

	console.log('Quack-Ext commands registered successfully!');

	// Auto-start proxy server when VS Code starts
	vscode.window.onDidChangeWindowState(async (state) => {
		if (state.focused && !protectionActive) {
			await autoStartProxyServer(context);
		}
	});

	// Also try to start immediately on activation
	setTimeout(async () => {
		await autoStartProxyServer(context);
	}, 1000);
}


export function deactivate() {
	protectionActive = false;
	if (statusBarItem) {
		statusBarItem.dispose();
	}
	if (mitmProcess) {
		mitmProcess.kill();
	}
	stopProxyPing();
}
