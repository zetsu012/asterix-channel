import { useEffect, useState } from 'react';
import './App.css';

interface SubChannel {
  id: string;
  name: string;
  created_at: string;
}

interface ParentChannel {
  id: string;
  name: string;
  created_at: string;
  sub_channels: SubChannel[];
}

interface WebViewMessage {
  command: string;
  payload?: unknown;
}

declare global {
  interface Window {
    acquireVsCodeApi(): {
      postMessage(message: WebViewMessage): void;
    };
  }
}

function App() {
  const [channels, setChannels] = useState<ParentChannel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set());

  useEffect(() => {
    const vscode = window.acquireVsCodeApi();
    
    vscode.postMessage({ command: 'ready' });

    const handleMessage = (event: MessageEvent<WebViewMessage>) => {
      const message = event.data;
      
      if (message.command === 'channelsLoaded') {
        setChannels(message.payload as ParentChannel[]);
        setError(null);
      } else if (message.command === 'error') {
        setError(message.payload as string);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const toggleChannel = (id: string) => {
    setExpandedChannels(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="app">
      <div className="header">
        <h2>Channels</h2>
      </div>
      
      {error && <div className="error">{error}</div>}
      
      {channels.length === 0 && !error && (
        <div className="empty">No channels yet</div>
      )}
      
      <div className="channel-list">
        {channels.map(channel => (
          <div key={channel.id} className="channel-item">
            <div 
              className="channel-header"
              onClick={() => toggleChannel(channel.id)}
            >
              <span className="expand-icon">
                {expandedChannels.has(channel.id) ? '▼' : '▶'}
              </span>
              <span className="channel-name">{channel.name}</span>
              <span className="channel-count">
                {channel.sub_channels.length}
              </span>
            </div>
            
            {expandedChannels.has(channel.id) && channel.sub_channels.length > 0 && (
              <div className="sub-channels">
                {channel.sub_channels.map(sub => (
                  <div key={sub.id} className="sub-channel-item">
                    <span className="sub-channel-icon">○</span>
                    <span className="sub-channel-name">{sub.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
