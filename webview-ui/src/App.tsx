import { useEffect, useState, useRef } from 'react';
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

interface Message {
  id: string;
  username: string;
  content: string;
  created_at: string;
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

const vscodeApi = typeof window !== 'undefined' ? window.acquireVsCodeApi() : null;

function App() {
  const [channels, setChannels] = useState<ParentChannel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set());
  const [view, setView] = useState<'channels' | 'messages'>('channels');
  const [activeSubChannel, setActiveSubChannel] = useState<SubChannel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const messageListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!vscodeApi) return;
    
    vscodeApi.postMessage({ command: 'ready' });

    const handleMessage = (event: MessageEvent<WebViewMessage>) => {
      const message = event.data;
      
      if (message.command === 'channelsLoaded') {
        setChannels(message.payload as ParentChannel[]);
        setError(null);
      } else if (message.command === 'messagesLoaded') {
        setMessages(message.payload as Message[]);
        setIsLoadingMessages(false);
      } else if (message.command === 'newMessage') {
        setMessages(prev => [...prev, message.payload as Message]);
      } else if (message.command === 'error') {
        setError(message.payload as string);
        setIsLoadingMessages(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
}, []);

  useEffect(() => {
    if (messageListRef.current && messages.length > 0) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages]);

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

  const openSubChannel = (subChannel: SubChannel) => {
    setActiveSubChannel(subChannel);
    setView('messages');
    setIsLoadingMessages(true);
    setMessages([]);
    
    if (vscodeApi) {
      vscodeApi.postMessage({ command: 'loadMessages', payload: subChannel.id });
    }
  };

  const goBack = () => {
    setView('channels');
    setActiveSubChannel(null);
    setMessages([]);
    setMessageInput('');
  };

  // const formatTimestamp = (timestamp: string) => {
  //   const date = new Date(timestamp);
  //   return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  // };

  const sortedMessages = [...messages].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const sendMessage = () => {
    if (!messageInput.trim() || !activeSubChannel || !vscodeApi) return;
    vscodeApi.postMessage({ 
      command: 'sendMessage', 
      payload: { subChannelId: activeSubChannel.id, content: messageInput.trim() } 
    });
    setMessageInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="app">
      {view === 'channels' ? (
        <>
          {error && <div className="error">{error}</div>}
          
          {channels.length === 0 && !error && (
            <div className="empty">No channels yet</div>
          )}
          
          <div className="channel-list">
            {channels.map(channel => (
              <div key={channel.id}>
                <div 
                  className="channel-item"
                  onClick={() => toggleChannel(channel.id)}
                >
                  <span className="channel-icon">
                    {expandedChannels.has(channel.id) ? '#' : '#'}
                  </span>
                  <span className="channel-name">{channel.name}</span>
                </div>
                {expandedChannels.has(channel.id) && channel.sub_channels.map(sub => (
                  <div 
                    key={sub.id} 
                    className="channel-item sub-channel-item"
                    onClick={() => openSubChannel(sub)}
                  >
                    <span className="channel-icon">#</span>
                    <span className="channel-name">{sub.name}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="messages-view">
          <div className="messages-header">
            <button className="back-button" onClick={goBack}>
              ←
            </button>
            <span className="channel-title"># {activeSubChannel?.name}</span>
          </div>
          
          {error && <div className="error">{error}</div>}
          
          {isLoadingMessages && (
            <div className="loading">Loading messages...</div>
          )}
          
          {!isLoadingMessages && messages.length === 0 && !error && (
            <div className="empty">No messages yet</div>
          )}
          
          <div className="message-list" ref={messageListRef}>
            {sortedMessages.map((msg) => (
              <div key={msg.id} className="message-item">
                <div className="message-content">
                  <span className="message-username">{msg.username}</span>
                  <span className="message-text">{msg.content}</span>
                </div>
              </div>
            ))}
          </div>
          
          <div className="message-input-container">
            <div className="current-user">
              <span className="user-label">Logged in as:</span>
              <span className="user-name">ankit-chhetri</span>
            </div>
            <div className="input-row">
              <input
                type="text"
                className="message-input"
                placeholder="Type a message..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={handleKeyPress}
              />
              <button className="send-button" onClick={sendMessage}>
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
