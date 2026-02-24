import * as vscode from 'vscode';
import { WebViewMessage, ParentChannel, ApiResponse, Message } from '../types';

const API_BASE_URL = 'https://vscode-channel-extension.onrender.com';
const WS_BASE_URL = 'wss://vscode-channel-extension.onrender.com';

interface SendMessagePayload {
  subChannelId: string;
  content: string;
}

export class DevChannelsPanel implements vscode.WebviewViewProvider {
  public static readonly viewType = 'devchannels.sidebar';
  
  private _view?: vscode.WebviewView;
  private _ws?: WebSocket;
  private _currentSubChannelId?: string;
  private _username: string = 'user';

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
        case 'loadMessages':
          const subChannelId = message.payload as string;
          this._fetchMessages(subChannelId);
          break;
        case 'sendMessage':
          const payload = message.payload as SendMessagePayload;
          this._sendWsMessage(payload.subChannelId, payload.content);
          break;
        default:
          console.log('Unknown message:', message);
      }
    });
  }

  private _connectWebSocket(subChannelId: string): void {
    if (this._ws && this._currentSubChannelId === subChannelId) {
      return;
    }

    if (this._ws) {
      this._ws.close();
    }

    try {
      this._ws = new WebSocket(`${WS_BASE_URL}/ws/${subChannelId}?username=${this._username}`);
      
      this._ws.onopen = () => {
        console.log('WebSocket connected');
      };

      this._ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.status === 200 && data.data) {
            if (data.message === 'New message') {
              this.postMessage({
                command: 'newMessage',
                payload: data.data
              });
            } else if (data.data.event === 'joined' || data.data.event === 'left') {
              console.log(`User ${data.data.username} ${data.data.event}`);
            }
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      this._ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      this._ws.onclose = () => {
        console.log('WebSocket closed');
      };

      this._currentSubChannelId = subChannelId;
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  }

  private _sendWsMessage(subChannelId: string, content: string): void {
    if (!this._ws || this._currentSubChannelId !== subChannelId) {
      this._connectWebSocket(subChannelId);
      setTimeout(() => {
        if (this._ws && this._ws.readyState === WebSocket.OPEN) {
          this._ws.send(JSON.stringify({ content }));
        }
      }, 500);
    } else if (this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify({ content }));
    }
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

  private async _fetchMessages(subChannelId: string): Promise<void> {
    try {
      console.log("subchanelid", subChannelId);
      this._connectWebSocket(subChannelId);
      
      const response = await fetch(`${API_BASE_URL}/channels/${subChannelId}/messages`);
      const json = await response.json() as ApiResponse<Message[]>;
      
      if (json.status === 200 && json.data) {
        this.postMessage({
          command: 'messagesLoaded',
          payload: json.data
        });
      } else {
        this.postMessage({
          command: 'error',
          payload: json.message || 'Failed to fetch messages'
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
