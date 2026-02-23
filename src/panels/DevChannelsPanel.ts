import * as vscode from 'vscode';
import { WebViewMessage, ParentChannel, ApiResponse } from '../types';

const API_BASE_URL = 'https://vscode-channel-extension.onrender.com';

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
          this._fetchChannels();
          break;
        default:
          console.log('Unknown message:', message);
      }
    });
  }

  private async _fetchChannels(): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/channels`);
      const json = await response.json() as ApiResponse<ParentChannel[]>;
      
      if (json.status === 200 && json.data) {
        this.postMessage({
          command: 'channelsLoaded',
          payload: json.data
        });
      } else {
        this.postMessage({
          command: 'error',
          payload: json.message || 'Failed to fetch channels'
        });
      }
    } catch (error) {
      this.postMessage({
        command: 'error',
        payload: 'Failed to connect to server'
      });
    }
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
