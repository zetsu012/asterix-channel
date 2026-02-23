import * as vscode from 'vscode';
import { WebViewMessage } from '../types';

export class DevChannelsPanel implements vscode.WebviewViewProvider {
  public static readonly viewType = 'devchannels.sidebar';
  
  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((message: WebViewMessage) => {
      switch (message.command) {
        case 'ready':
          console.log('WebView ready');
          break;
        default:
          console.log('Unknown message:', message);
      }
    });
  }

  public postMessage(message: WebViewMessage): void {
    if (this._view) {
      this._view.webview.postMessage(message);
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const distUri = vscode.Uri.joinPath(this._extensionUri, 'webview-ui', 'dist');
    
    const indexHtmlUri = vscode.Uri.joinPath(distUri, 'index.html');
    const indexHtml = require('fs').readFileSync(indexHtmlUri.fsPath, 'utf-8');
    
    const assetsUri = webview.asWebviewUri(distUri);
    
    return indexHtml
      .replace(/src="\/([^"]+)"/g, `src="${assetsUri}/$1"`)
      .replace(/href="\/([^"]+)"/g, `href="${assetsUri}/$1"`)
      .replace(/src="([^"]+)"/g, (match: string, p1: string) => {
        if (p1.startsWith('http') || p1.startsWith('//') || p1.startsWith('data:')) {
          return match;
        }
        return `src="${assetsUri}/${p1}"`;
      })
      .replace(/href="([^"]+)"/g, (match: string, p1: string) => {
        if (p1.startsWith('http') || p1.startsWith('//') || p1.startsWith('data:')) {
          return match;
        }
        return `href="${assetsUri}/${p1}"`;
      });
  }
}
