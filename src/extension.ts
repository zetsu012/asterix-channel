import * as vscode from 'vscode';
import { DevChannelsPanel } from './panels/DevChannelsPanel';

export function activate(context: vscode.ExtensionContext) {
  console.log('DevChannels extension is now active');

  const provider = new DevChannelsPanel(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      DevChannelsPanel.viewType,
      provider
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('devchannels.open', () => {
      vscode.commands.executeCommand('workbench.view.extension.devchannels-sidebar');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('devchannels.focus', () => {
      vscode.commands.executeCommand('workbench.view.extension.devchannels-sidebar');
    })
  );
}

export function deactivate() {}
