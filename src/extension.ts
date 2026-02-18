// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { HelloWorldProvider } from './sidebarProvider';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "asterix-channel" is now active!');

	const disposable = vscode.commands.registerCommand('asterix-channel.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from asterix-channel!');
	});

	const helloWorldProvider = new HelloWorldProvider();
	const treeView = vscode.window.createTreeView('asterix-channel.helloWorldView', {
		treeDataProvider: helloWorldProvider
	});

	context.subscriptions.push(disposable, treeView);
}

// This method is called when your extension is deactivated
export function deactivate() {}
