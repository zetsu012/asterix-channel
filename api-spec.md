# DevChannels API Specification

**Base URL:** `https://vscode-channel-extension.onrender.com`

---

## Response Format

All endpoints return a consistent envelope:

```typescript
interface ApiResponse<T> {
  status: number;       // HTTP status code
  message: string;      // Human-readable message
  data: T | null;       // Response data or null on error
}
```

---

## Endpoints

### 1. Create Parent Channel

Create a top-level room (container for sub-channels).

```
POST /channels
```

**Request:**
```json
{
  "name": "ankit-room"
}
```

**Response 201:**
```json
{
  "status": 201,
  "message": "Channel created successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "ankit-room",
    "parent_id": null,
    "created_at": "2026-02-22T10:00:00Z"
  }
}
```

**Error 400 (duplicate name):**
```json
{
  "status": 400,
  "message": "Channel name already exists",
  "data": null
}
```

---

### 2. List All Parent Channels

Fetch all parent channels with their nested sub-channels. Call this on extension load.

```
GET /channels
```

**Response 200:**
```json
{
  "status": 200,
  "message": "Channels fetched successfully",
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "ankit-room",
      "created_at": "2026-02-22T10:00:00Z",
      "sub_channels": [
        {
          "id": "660e8400-e29b-41d4-a716-446655440001",
          "name": "code-review",
          "created_at": "2026-02-22T10:05:00Z"
        },
        {
          "id": "660e8400-e29b-41d4-a716-446655440002",
          "name": "architecture",
          "created_at": "2026-02-22T10:06:00Z"
        }
      ]
    }
  ]
}
```

---

### 3. Create Sub-Channel

Create a chat room inside a parent channel.

```
POST /channels/{channel_id}/sub-channels
```

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `channel_id` | UUID | ID of the parent channel |

**Request:**
```json
{
  "name": "code-review"
}
```

**Response 201:**
```json
{
  "status": 201,
  "message": "Sub-channel created successfully",
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "name": "code-review",
    "parent_id": "550e8400-e29b-41d4-a716-446655440000",
    "created_at": "2026-02-22T10:05:00Z"
  }
}
```

**Error 400 (duplicate name):**
```json
{
  "status": 400,
  "message": "Sub-channel name already exists in this channel",
  "data": null
}
```

**Error 400 (nesting):**
```json
{
  "status": 400,
  "message": "Cannot create a sub-channel inside a sub-channel",
  "data": null
}
```

**Error 404:**
```json
{
  "status": 404,
  "message": "Channel not found",
  "data": null
}
```

---

### 4. List Sub-Channels

Get all sub-channels for a parent channel.

```
GET /channels/{channel_id}/sub-channels
```

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `channel_id` | UUID | Id of the parent channel |

**Response 200:**
```json
{
  "status": 200,
  "message": "Sub-channels fetched successfully",
  "data": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "name": "code-review",
      "created_at": "2026-02-22T10:05:00Z"
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440002",
      "name": "architecture",
      "created_at": "2026-02-22T10:06:00Z"
    }
  ]
}
```

**Error 404:**
```json
{
  "status": 404,
  "message": "Channel not found",
  "data": null
}
```

---

### 5. Get Message History

Load message history for a sub-channel. Call this when user enters a room.

```
GET /channels/{channel_id}/messages
```

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `channel_id` | UUID | Id of the **sub-channel** (not parent) |

**Query Parameters:**
| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `limit` | int | 50 | 100 | Number of messages to return |
| `before` | string | - | - | ISO timestamp for pagination (messages before this time) |

**Example:**
```
GET /channels/660e8400-e29b-41d4-a716-446655440001/messages?limit=20&before=2026-02-22T10:00:00Z
```

**Response 200:**
```json
{
  "status": 200,
  "message": "Messages fetched successfully",
  "data": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440001",
      "username": "ankit",
      "content": "hey team!",
      "created_at": "2026-02-22T10:00:00Z"
    },
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "username": "john",
      "content": "hello!",
      "created_at": "2026-02-22T10:01:00Z"
    }
  ]
}
```

**Error 400 (called on parent channel):**
```json
{
  "status": 400,
  "message": "Messages only exist inside sub-channels",
  "data": null
}
```

**Error 404:**
```json
{
  "status": 404,
  "message": "Channel not found",
  "data": null
}
```

---

## WebSocket - Real-time Chat

Connect to a sub-channel for real-time messaging.

```
WS /ws/{channel_id}?username={username}
```

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `channel_id` | UUID | Id of the **sub-channel** |

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `username` | string | Yes | Display name of the user |

**Example:**
```
wss://vscode-channel-extension.vercel.app/ws/660e8400-e29b-41d4-a716-446655440001?username=ankit
```

---

### WebSocket Events

#### 1. On Connect - User Joined (broadcast to all in room)

```json
{
  "status": 200,
  "message": "User joined",
  "data": {
    "username": "ankit",
    "event": "joined"
  }
}
```

#### 2. Send Message (client → server)

```json
{
  "content": "hey team!"
}
```

#### 3. New Message (server → all clients in room)

```json
{
  "status": 200,
  "message": "New message",
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440003",
    "username": "ankit",
    "content": "hey team!",
    "created_at": "2026-02-22T10:02:00Z"
  }
}
```

#### 4. On Disconnect - User Left (broadcast to remaining users)

```json
{
  "status": 200,
  "message": "User left",
  "data": {
    "username": "ankit",
    "event": "left"
  }
}
```

---

### WebSocket Error Codes

| Code | Reason |
|------|--------|
| 4000 | Cannot connect to a parent channel. Join a sub-channel to chat. |
| 4000 | Channel not found |
| 4000 | Invalid channel ID |
| 4001 | Message content is required (empty or missing `content` field) |
| 4001 | Invalid message format (not valid JSON) |

---

## TypeScript Interfaces

```typescript
// Channel Types
interface Channel {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
}

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

// Message Types
interface Message {
  id: string;
  username: string;
  content: string;
  created_at: string;
}

// WebSocket Types
interface WsUserEvent {
  username: string;
  event: "joined" | "left";
}

interface WsMessageEvent {
  id: string;
  username: string;
  content: string;
  created_at: string;
}

interface WsSendMessage {
  content: string;
}
```

---

## Error Reference

| Status | Message |
|--------|---------|
| 400 | Channel name already exists |
| 400 | Sub-channel name already exists in this channel |
| 400 | Cannot create a sub-channel inside a sub-channel |
| 400 | Messages only exist inside sub-channels |
| 404 | Channel not found |
| 500 | Internal server error |

---

## Usage Flow

1. **On Extension Load:** `GET /channels` → Display parent channels with sub-channels in sidebar
2. **Create Room:** `POST /channels` → Create new parent channel
3. **Create Chat Room:** `POST /channels/{parent_id}/sub-channels` → Create sub-channel
4. **Enter Room:**
   - `GET /channels/{sub_channel_id}/messages` → Load history
   - `WS /ws/{sub_channel_id}?username=...` → Connect WebSocket
5. **Chat:** Send `{ "content": "message" }` over WebSocket
6. **Leave Room:** Close WebSocket connection
