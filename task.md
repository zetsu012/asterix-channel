# DevChannels — VSCode Extension
**Source of Truth for AI Agent**
**Version:** 1.0.0 (MVP)

---

## What Are We Building

DevChannels is a VSCode extension that adds a Discord-like chat system directly inside VSCode. Developers can create rooms (parent channels), create sub-channels inside those rooms, enter any sub-channel, and chat with their teammates in real-time — all without leaving their editor.

Think of it as a lightweight Discord embedded inside VSCode. No browser, no context switching, no separate app.

---

## Project Structure

The extension has two completely separate parts that live in the same repo:

```
asterix-xhannel/
├── src/                        ← VSCode extension backend (TypeScript)
│   ├── extension.ts            ← entry point, registers commands + panel
│
├── webview-ui/                 ← React app (runs inside the WebView panel)
│   ├── src/
│   │   ├── App.tsx             ← root component, handles top-level routing
│   │   ├── components/
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
│
├── package.json                ← extension manifest + scripts
└── tsconfig.json
```

---

## How the Two Parts Communicate

The VSCode extension sandbox does not allow the WebView to make direct HTTP or WebSocket calls to external servers. All network calls must go through the extension host (`src/`).

Communication between the two parts works via `postMessage`:

```
WebView (React)  →  postMessage  →  extension.ts  →  FastAPI / WebSocket
FastAPI / WebSocket  →  extension.ts  →  postMessage  →  WebView (React)
```

**WebView sends to extension:**
```ts
vscode.postMessage({ command: 'createChannel', payload: { name: 'ankit-room' } })
vscode.postMessage({ command: 'joinSubChannel', payload: { channelId: 'uuid' } })
vscode.postMessage({ command: 'sendMessage', payload: { content: 'hey!' } })
```

**Extension sends to WebView:**
```ts
panel.webview.postMessage({ command: 'channelsLoaded', payload: [...channels] })
panel.webview.postMessage({ command: 'newMessage', payload: { ...message } })
panel.webview.postMessage({ command: 'userJoined', payload: { username } })
panel.webview.postMessage({ command: 'userLeft', payload: { username } })
panel.webview.postMessage({ command: 'error', payload: { message: '...' } })
```

---

## src/ — Extension Host Responsibilities

This is the Node.js layer. It has full access to VSCode APIs and the network.

### extension.ts
- Entry point of the extension
- Registers a command `devchannels.open` that opens the WebView panel
- Registers the activity bar icon that triggers the panel
- On activation, initialises `DevChannelsPanel`

### panels/DevChannelsPanel.ts
- Creates and manages the WebView panel
- Loads the built React app (`webview-ui/dist`) into the panel
- Listens for all `postMessage` events from the WebView
- Routes each command to the appropriate service (`ApiService` or `WebSocketService`)
- Forwards responses back to the WebView via `panel.webview.postMessage`

### services/ApiService.ts
- Handles all HTTP calls to the FastAPI backend
- Methods:
  - `getChannels()` — GET all parent channels with sub-channels
  - `createChannel(name)` — POST create a parent channel
  - `createSubChannel(channelId, name)` — POST create a sub-channel
  - `getMessages(channelId)` — GET last 50 messages for a sub-channel
- All methods return typed responses
- Backend base URL is read from VSCode workspace configuration: `devchannels.serverUrl`

### services/WebSocketService.ts
- Owns the single WebSocket connection
- Connects to `ws://{serverUrl}/ws/{channelId}?username={username}`
- On message received: forwards to the WebView via `panel.webview.postMessage`
- On disconnect: attempts reconnection with exponential backoff
- Methods:
  - `connect(channelId, username)` — open WS connection to a sub-channel
  - `disconnect()` — close current connection
  - `sendMessage(content)` — send message over the open WS

### types/index.ts
- Shared interfaces used across src/:
  - `Channel` — `{ id, name, parent_id, created_at, sub_channels? }`
  - `Message` — `{ id, username, content, created_at }`
  - `WebViewMessage` — `{ command, payload }`

---

## webview-ui/ — React App Responsibilities

This is a standard React + Vite app. It has NO direct access to the network. It only communicates via `postMessage`.

### App.tsx
- Root component
- Manages top-level view state: which parent channel is selected, which sub-channel is active
- On mount: sends `{ command: 'getChannels' }` to extension to load channel list
- Listens to all incoming `postMessage` events from the extension and updates store

### components/ChannelList.tsx
- Displays all parent channels in the left sidebar
- Clicking a parent channel expands it to show its sub-channels via `SubChannelList`
- Has a "+" button to create a new parent channel
- On create: sends `{ command: 'createChannel', payload: { name } }` to extension

### components/SubChannelList.tsx
- Renders the list of sub-channels under the selected parent
- Has a "+" button to create a new sub-channel
- Clicking a sub-channel: sends `{ command: 'joinSubChannel', payload: { channelId } }` to extension
- On join: extension fetches message history and opens WS — then sends back `channelsLoaded` and messages

### components/ChatPane.tsx
- Renders when a sub-channel is active
- Shows the list of `MessageBubble` components
- Has a text input at the bottom
- On send: sends `{ command: 'sendMessage', payload: { content } }` to extension
- Auto-scrolls to bottom on new message
- Shows "username joined" / "username left" events as subtle system messages

### components/MessageBubble.tsx
- Renders a single message
- Shows username, content, and timestamp
- Different style for system events (joined/left) vs regular messages

### store/useChatStore.ts
- Zustand store
- State:
  - `channels` — full channel list with sub-channels
  - `activeParentId` — currently selected parent channel
  - `activeSubChannelId` — currently active sub-channel
  - `messages` — messages in the active sub-channel
  - `username` — current user's display name
- Actions:
  - `setChannels`, `addChannel`, `addSubChannel`
  - `setActiveSubChannel`
  - `addMessage`, `setMessages`
  - `setUsername`

### hooks/useVsCodeApi.ts
- Acquires the `vscode` API instance using `acquireVsCodeApi()`
- Returns it as a stable ref so components can call `vscode.postMessage`
- Must only be called once — `acquireVsCodeApi()` throws if called more than once

---

## User Flow

```
1. User opens VSCode
2. Clicks the DevChannels icon in the Activity Bar
3. WebView panel opens
4. App loads → sends getChannels to extension
5. Extension calls GET /channels → sends channelsLoaded back to WebView
6. User sees list of parent channels in sidebar

7. User clicks a parent channel → sub-channels expand
8. User clicks a sub-channel → sends joinSubChannel to extension
9. Extension calls GET /channels/{id}/messages → sends message history to WebView
10. Extension opens WS connection to /ws/{channel_id}?username=ankit
11. ChatPane renders with message history

12. User types a message → sends sendMessage to extension
13. Extension sends over WebSocket
14. Server broadcasts to all in room
15. All connected users receive the message via onmessage → postMessage → WebView re-renders

16. User clicks different sub-channel → extension closes old WS, opens new one
```

---

## Username

For MVP, username is set via VSCode workspace configuration:
```json
"devchannels.username": "ankit"
```
Extension reads it via `vscode.workspace.getConfiguration('devchannels').get('username')`.
If not set, prompt the user to set it via `vscode.window.showInputBox`.

---

## Configuration (settings.json)

```json
{
  "devchannels.serverUrl": "https://your-backend.onrender.com",
  "devchannels.username": "ankit"
}
```

Extension reads both of these on startup via `vscode.workspace.getConfiguration('devchannels')`.

---

## Key Constraints for AI Agent

- `webview-ui/` and `src/` are completely separate. The React app never imports anything from `src/` and vice versa.
- All network calls (HTTP + WebSocket) live exclusively in `src/services/`. Never in the React app.
- The React app communicates with the extension ONLY via `postMessage`. No exceptions.
- `acquireVsCodeApi()` must only be called once in the entire React app — use the `useVsCodeApi` hook.
- The WebSocket connection is owned by `WebSocketService.ts`. Only one WS connection is open at a time. Switching sub-channels closes the old connection before opening a new one.
- The React app is built with Vite. The extension loads the built output from `webview-ui/dist`.
- Use `vscode.window.showErrorMessage` for any errors in the extension host layer.
- All async operations in `src/` must use try/catch and forward errors to the WebView via `{ command: 'error', payload: { message } }`.