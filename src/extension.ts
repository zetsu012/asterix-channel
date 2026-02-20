// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { HelloWorldProvider } from './sidebarProvider';
import { WebRTCTestPanel } from './webrtcTest';
import { VoiceCallServer } from './voiceCallServer';

let voiceCallServer: VoiceCallServer | null = null;

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "asterix-channel" is now active!');

	const disposable = vscode.commands.registerCommand('asterix-channel.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from asterix-channel!');
	});

	const webrtcTestCmd = vscode.commands.registerCommand('asterix-channel.webrtcTest', () => {
		WebRTCTestPanel.createOrShow(context.extensionUri);
	});

	const startVoiceCallCmd = vscode.commands.registerCommand('asterix-channel.startVoiceCall', async () => {
		if (voiceCallServer) {
			vscode.window.showWarningMessage('Voice call server is already running.');
			return;
		}

		try {
			voiceCallServer = new VoiceCallServer(9876);
			
			voiceCallServer.onClientMessage((data) => {
				if (data.type === 'log') {
					console.log('[VoiceCall]', data.message);
				}
			});

			const url = await voiceCallServer.start();
			
			const choice = await vscode.window.showInformationMessage(
				'Voice call server started. Open in browser?',
				'Open Browser',
				'Copy URL'
			);

			if (choice === 'Open Browser') {
				vscode.env.openExternal(vscode.Uri.parse(url));
			} else if (choice === 'Copy URL') {
				vscode.env.clipboard.writeText(url);
				vscode.window.showInformationMessage(`URL copied: ${url}`);
			}
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to start voice call server: ${error}`);
			voiceCallServer = null;
		}
	});

	const stopVoiceCallCmd = vscode.commands.registerCommand('asterix-channel.stopVoiceCall', () => {
		if (voiceCallServer) {
			voiceCallServer.stop();
			voiceCallServer = null;
			vscode.window.showInformationMessage('Voice call server stopped.');
		} else {
			vscode.window.showWarningMessage('Voice call server is not running.');
		}
	});

	const helloWorldProvider = new HelloWorldProvider();
	const treeView = vscode.window.createTreeView('asterix-channel.helloWorldView', {
		treeDataProvider: helloWorldProvider
	});

	context.subscriptions.push(
		disposable,
		webrtcTestCmd,
		startVoiceCallCmd,
		stopVoiceCallCmd,
		treeView
	);
}

export function deactivate() {
	if (voiceCallServer) {
		voiceCallServer.stop();
		voiceCallServer = null;
	}
}
