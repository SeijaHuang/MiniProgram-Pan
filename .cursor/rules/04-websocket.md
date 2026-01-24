# WebSocket Real-time Communication Rules

**CRITICAL**: This project is a two-player chat room system using WebSocket for real-time communication. Follow the backend API specification strictly.

---

## Backend Specification Reference

**MUST READ**: [backend/docs/api-specification.md](../backend/docs/api-specification.md)

### Server Endpoints

- **HTTP Server**: `http://localhost:8080`
- **WebSocket Server**: `ws://localhost:8080/ws`

### Message Protocol

All WebSocket messages follow this format:

```typescript
{
    type: string; // Message type
    data: object; // Message data
    timestamp: number; // Message timestamp
}
```

---

## WebSocket Manager Pattern

### Create Singleton WebSocket Manager

**Reference**: [backend/docs/features/04-connection-lifecycle.md](../backend/docs/features/04-connection-lifecycle.md)

- Centralize WebSocket logic in a manager class
- Use singleton pattern for single connection
- Match backend message protocol exactly
- Example:

    ```typescript
    // services/websocket-manager.ts
    import type {
        IWSMessage,
        IWSErrorMessage,
    } from '../types/websocket-common';

    interface IWebSocketConfig {
        url: string;
        heartbeatInterval?: number;
        reconnectInterval?: number;
        maxReconnectAttempts?: number;
    }

    type MessageHandler = (message: IWSMessage) => void;
    type ConnectionStateHandler = (isConnected: boolean) => void;

    class WebSocketManager {
        private static instance: WebSocketManager;
        private socketTask: WechatMiniprogram.SocketTask | null = null;
        private config: IWebSocketConfig | null = null;
        private messageHandlers: Map<string, MessageHandler[]> = new Map();
        private connectionStateHandlers: ConnectionStateHandler[] = [];
        private heartbeatTimer: number | null = null;
        private reconnectTimer: number | null = null;
        private reconnectAttempts = 0;
        private isConnected = false;
        private shouldReconnect = true;

        private constructor() {}

        static getInstance(): WebSocketManager {
            if (!WebSocketManager.instance) {
                WebSocketManager.instance = new WebSocketManager();
            }
            return WebSocketManager.instance;
        }

        connect(config: IWebSocketConfig): Promise<void> {
            return new Promise((resolve, reject) => {
                this.config = config;
                this.shouldReconnect = true;

                this.socketTask = wx.connectSocket({
                    url: config.url,
                    success: () => {
                        console.log('[WebSocket] Connection initiated');
                    },
                    fail: error => {
                        console.error('[WebSocket] Connection failed:', error);
                        reject(error);
                    },
                });

                this.socketTask.onOpen(() => {
                    console.log('[WebSocket] Connected');
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    this.notifyConnectionState(true);
                    this.startHeartbeat();
                    resolve();
                });

                this.socketTask.onMessage(res => {
                    this.handleMessage(res.data);
                });

                this.socketTask.onError(error => {
                    console.error('[WebSocket] Error:', error);
                    this.handleError(error);
                });

                this.socketTask.onClose(() => {
                    console.log('[WebSocket] Closed');
                    this.handleClose();
                });
            });
        }

        disconnect(): void {
            this.shouldReconnect = false;
            this.stopHeartbeat();
            this.stopReconnect();

            if (this.socketTask) {
                this.socketTask.close({
                    code: 1000,
                    reason: 'Client disconnect',
                });
                this.socketTask = null;
            }

            this.isConnected = false;
            this.notifyConnectionState(false);
        }

        send(type: string, data: unknown): void {
            if (!this.isConnected || !this.socketTask) {
                console.error('[WebSocket] Not connected');
                throw new Error('WebSocket not connected');
            }

            const message: IWSMessage = {
                type,
                data,
                timestamp: Date.now(),
            };

            this.socketTask.send({
                data: JSON.stringify(message),
                success: () => {
                    console.log('[WebSocket] Message sent:', type);
                },
                fail: error => {
                    console.error('[WebSocket] Failed to send message:', error);
                },
            });
        }

        on(messageType: string, handler: MessageHandler): void {
            if (!this.messageHandlers.has(messageType)) {
                this.messageHandlers.set(messageType, []);
            }
            this.messageHandlers.get(messageType)!.push(handler);
        }

        off(messageType: string, handler: MessageHandler): void {
            const handlers = this.messageHandlers.get(messageType);
            if (handlers) {
                const index = handlers.indexOf(handler);
                if (index > -1) {
                    handlers.splice(index, 1);
                }
            }
        }

        onConnectionStateChange(handler: ConnectionStateHandler): void {
            this.connectionStateHandlers.push(handler);
        }

        private handleMessage(rawData: string | ArrayBuffer): void {
            try {
                const messageStr =
                    typeof rawData === 'string'
                        ? rawData
                        : String.fromCharCode.apply(
                              null,
                              new Uint8Array(rawData) as any
                          );

                const message = JSON.parse(messageStr) as IWSMessage;

                console.log('[WebSocket] Received:', message.type);

                // Handle ERROR messages
                if (message.type === 'ERROR') {
                    this.handleErrorMessage(message as IWSErrorMessage);
                    return;
                }

                const handlers = this.messageHandlers.get(message.type);
                if (handlers) {
                    handlers.forEach(handler => handler(message));
                }
            } catch (error) {
                console.error('[WebSocket] Failed to parse message:', error);
            }
        }

        private handleErrorMessage(errorMessage: IWSErrorMessage): void {
            console.error('[WebSocket] Server error:', errorMessage.data);

            const { code, message } = errorMessage.data;

            // Show user-friendly error messages
            const errorTexts: Record<string, string> = {
                ROOM_NOT_FOUND: '房间不存在',
                ROOM_FULL: '房间已满',
                ROOM_CLOSED: '房间已关闭',
                ALREADY_JOINED: '您已在房间中',
                NOT_PARTICIPANT: '您不是房间成员',
                ROOM_NOT_READY: '等待对方加入',
                INVALID_PAYLOAD: '消息格式错误',
            };

            wx.showToast({
                title: errorTexts[code] || message,
                icon: 'none',
                duration: 2000,
            });
        }

        private handleError(
            error: WechatMiniprogram.GeneralCallbackResult
        ): void {
            this.isConnected = false;
            this.notifyConnectionState(false);
            this.attemptReconnect();
        }

        private handleClose(): void {
            this.isConnected = false;
            this.stopHeartbeat();
            this.notifyConnectionState(false);

            if (this.shouldReconnect) {
                this.attemptReconnect();
            }
        }

        private attemptReconnect(): void {
            if (!this.config) return;

            const maxAttempts = this.config.maxReconnectAttempts || 5;
            if (this.reconnectAttempts >= maxAttempts) {
                console.error('[WebSocket] Max reconnection attempts reached');
                wx.showModal({
                    title: '连接失败',
                    content: '无法连接到服务器，请稍后重试',
                    showCancel: false,
                });
                return;
            }

            const interval = this.config.reconnectInterval || 3000;
            this.reconnectAttempts++;

            console.log(
                `[WebSocket] Reconnecting in ${interval}ms (${this.reconnectAttempts}/${maxAttempts})`
            );

            this.reconnectTimer = setTimeout(() => {
                this.connect(this.config!).catch(error => {
                    console.error('[WebSocket] Reconnection failed:', error);
                });
            }, interval) as unknown as number;
        }

        private startHeartbeat(): void {
            const interval = this.config?.heartbeatInterval || 30000;

            this.heartbeatTimer = setInterval(() => {
                if (this.isConnected) {
                    this.send('HEARTBEAT', { timestamp: Date.now() });
                }
            }, interval) as unknown as number;
        }

        private stopHeartbeat(): void {
            if (this.heartbeatTimer) {
                clearInterval(this.heartbeatTimer);
                this.heartbeatTimer = null;
            }
        }

        private stopReconnect(): void {
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
            this.reconnectAttempts = 0;
        }

        private notifyConnectionState(isConnected: boolean): void {
            this.connectionStateHandlers.forEach(handler =>
                handler(isConnected)
            );
        }

        getConnectionState(): boolean {
            return this.isConnected;
        }
    }

    export const wsManager = WebSocketManager.getInstance();
    ```

---

## Message Types (Backend Specification)

**Reference**: [backend/docs/api-specification.md](../backend/docs/api-specification.md)

### Client → Server Messages

| Type        | Description               | Reference                                                             |
| ----------- | ------------------------- | --------------------------------------------------------------------- |
| `JOIN_ROOM` | Join a room via room code | [02-join-room.md](../backend/docs/features/02-join-room.md)           |
| `CHAT_SEND` | Send a chat message       | [03-chat-messaging.md](../backend/docs/features/03-chat-messaging.md) |

### Server → Client Messages

| Type           | Description                      | Reference                                                             |
| -------------- | -------------------------------- | --------------------------------------------------------------------- |
| `JOIN_ACK`     | Confirm room join (broadcast)    | [02-join-room.md](../backend/docs/features/02-join-room.md)           |
| `CHAT_RECEIVE` | Receive chat message (broadcast) | [03-chat-messaging.md](../backend/docs/features/03-chat-messaging.md) |
| `ERROR`        | Error message                    | [05-error-handling.md](../backend/docs/features/05-error-handling.md) |

---

## Usage in App

### Initialize WebSocket on App Launch

**Reference**: [backend/docs/features/04-connection-lifecycle.md](../backend/docs/features/04-connection-lifecycle.md)

- Connect WebSocket in App lifecycle
- Use production WebSocket URL
- Example:

    ```typescript
    // app.ts
    import { wsManager } from './services/websocket-manager';
    import { WS_URL } from './constants/config';

    App<IAppOption>({
        globalData: {
            wsConnected: false,
        },

        onLaunch() {
            this.initWebSocket();
        },

        async initWebSocket() {
            try {
                await wsManager.connect({
                    url: WS_URL, // ws://localhost:8080/ws (dev)
                    heartbeatInterval: 30000,
                    reconnectInterval: 3000,
                    maxReconnectAttempts: 5,
                });

                wsManager.onConnectionStateChange(isConnected => {
                    this.globalData.wsConnected = isConnected;

                    if (isConnected) {
                        console.log('[App] WebSocket connected');
                    } else {
                        console.log('[App] WebSocket disconnected');
                    }
                });

                console.log('[App] WebSocket initialized');
            } catch (error) {
                console.error('[App] Failed to initialize WebSocket:', error);
            }
        },

        onHide() {
            // Keep connection alive when app is in background
        },

        onUnload() {
            wsManager.disconnect();
        },
    });
    ```

---

## Usage in Pages

### Join Room Example

**Reference**: [backend/docs/features/02-join-room.md](../backend/docs/features/02-join-room.md)

- Send `JOIN_ROOM` message after WebSocket connection
- Handle `JOIN_ACK` broadcast
- Example:

    ```typescript
    // pages/waiting-room/index.ts
    import { wsManager } from '../../services/websocket-manager';
    import type {
        IJoinRoomMessage,
        IJoinAckMessage,
    } from '../../types/room-websocket';

    Page({
        data: {
            roomCode: '',
            room: null as IRoom | null,
            connectionStatus: 'disconnected' as 'connected' | 'disconnected',
        },

        onLoad(options: { roomCode: string }) {
            this.setData({ roomCode: options.roomCode });
            this.registerMessageHandlers();
            this.joinRoom();
        },

        onUnload() {
            this.unregisterMessageHandlers();
        },

        registerMessageHandlers() {
            wsManager.on('JOIN_ACK', this.handleJoinAck);
            wsManager.on('ERROR', this.handleError);
            wsManager.onConnectionStateChange(this.handleConnectionStateChange);
        },

        unregisterMessageHandlers() {
            wsManager.off('JOIN_ACK', this.handleJoinAck);
            wsManager.off('ERROR', this.handleError);
        },

        joinRoom() {
            const app = getApp<IAppOption>();
            const { roomCode } = this.data;

            if (!wsManager.getConnectionState()) {
                wx.showToast({
                    title: '连接中，请稍候',
                    icon: 'loading',
                });
                return;
            }

            try {
                const message: IJoinRoomMessage = {
                    type: 'JOIN_ROOM',
                    data: {
                        roomCode,
                        user: {
                            userId: app.globalData.userId,
                            nickname: app.globalData.nickname,
                        },
                    },
                    timestamp: Date.now(),
                };

                wsManager.send('JOIN_ROOM', message.data);
            } catch (error) {
                console.error('[WaitingRoom] Failed to join room:', error);
                wx.showToast({
                    title: '加入房间失败',
                    icon: 'error',
                });
            }
        },

        handleJoinAck: function (message: IJoinAckMessage) {
            console.log('[WaitingRoom] JOIN_ACK received:', message.data);

            const { room } = message.data;
            this.setData({ room });

            // Check if room is ready (2 participants)
            if (room.status === 'READY') {
                wx.showToast({
                    title: '房间已就绪',
                    icon: 'success',
                });

                // Navigate to chat room after delay
                setTimeout(() => {
                    wx.redirectTo({
                        url: `/pages/chat-room/index?roomId=${room.roomId}`,
                    });
                }, 1000);
            }
        },

        handleError: function (message: IWSErrorMessage) {
            console.error('[WaitingRoom] Error:', message.data);
            // Error is already handled by WebSocketManager
        },

        handleConnectionStateChange: function (isConnected: boolean) {
            this.setData({
                connectionStatus: isConnected ? 'connected' : 'disconnected',
            });

            if (!isConnected) {
                wx.showToast({
                    title: '连接断开',
                    icon: 'none',
                });
            }
        },
    });
    ```

### Chat Messaging Example

**Reference**: [backend/docs/features/03-chat-messaging.md](../backend/docs/features/03-chat-messaging.md)

- Send `CHAT_SEND` message with text content only
- Receive `CHAT_RECEIVE` broadcast (including sender's own message)
- Example:

    ```typescript
    // pages/chat-room/index.ts
    import { wsManager } from '../../services/websocket-manager';
    import type {
        IChatSendMessage,
        IChatReceiveMessage,
    } from '../../types/chat-websocket';
    import type { IMessage } from '../../models/message';

    Page({
        data: {
            messages: [] as IMessage[],
            inputText: '',
            myUserId: '',
        },

        onLoad() {
            const app = getApp<IAppOption>();
            this.setData({ myUserId: app.globalData.userId });

            this.registerMessageHandlers();
        },

        onUnload() {
            this.unregisterMessageHandlers();
        },

        registerMessageHandlers() {
            wsManager.on('CHAT_RECEIVE', this.handleChatReceive);
            wsManager.on('ERROR', this.handleError);
        },

        unregisterMessageHandlers() {
            wsManager.off('CHAT_RECEIVE', this.handleChatReceive);
            wsManager.off('ERROR', this.handleError);
        },

        handleInputChange(e: WechatMiniprogram.Input) {
            this.setData({ inputText: e.detail.value });
        },

        handleSendMessage() {
            const { inputText } = this.data;

            if (!inputText.trim()) {
                return;
            }

            try {
                // Client sends only content (no messageId or timestamp)
                const message: IChatSendMessage = {
                    type: 'CHAT_SEND',
                    data: {
                        content: {
                            type: 'TEXT',
                            text: inputText,
                        },
                    },
                    timestamp: Date.now(),
                };

                wsManager.send('CHAT_SEND', message.data);

                // Clear input
                this.setData({ inputText: '' });
            } catch (error) {
                console.error('[ChatRoom] Failed to send message:', error);
                wx.showToast({
                    title: '发送失败',
                    icon: 'error',
                });
            }
        },

        handleChatReceive: function (message: IChatReceiveMessage) {
            console.log('[ChatRoom] CHAT_RECEIVE:', message.data);

            const { message: chatMessage } = message.data;

            // Server broadcasts to all participants (including sender)
            // Use server-generated messageId and createdAt
            const newMessage: IMessage = {
                messageId: chatMessage.messageId,
                roomId: chatMessage.roomId,
                sender: chatMessage.sender,
                type: chatMessage.type,
                content: chatMessage.content,
                createdAt: chatMessage.createdAt,
                isMine: chatMessage.sender.userId === this.data.myUserId,
            };

            this.setData({
                messages: [...this.data.messages, newMessage],
            });

            // Scroll to bottom
            this.scrollToBottom();
        },

        handleError: function (message: IWSErrorMessage) {
            console.error('[ChatRoom] Error:', message.data);
            // Error is already handled by WebSocketManager
        },

        scrollToBottom() {
            wx.createSelectorQuery()
                .select('#message-list')
                .boundingClientRect(rect => {
                    if (rect) {
                        wx.pageScrollTo({
                            scrollTop: rect.bottom,
                            duration: 300,
                        });
                    }
                })
                .exec();
        },
    });
    ```

---

## Type Definitions (CRITICAL)

**Reference**: [backend/docs/api-specification.md](../backend/docs/api-specification.md)

### Define Message Types Matching Backend

All message types MUST match the backend specification exactly.

```typescript
// types/websocket-common.ts
export interface IWSMessage {
    type: string;
    data: unknown;
    timestamp: number;
}

export interface IWSErrorMessage extends IWSMessage {
    type: 'ERROR';
    data: {
        code: string;
        message: string;
        context?: unknown;
    };
}

// types/room-websocket.ts
import type { IRoom } from '../models/room';
import type { IUser } from '../models/user';

export interface IJoinRoomMessage {
    type: 'JOIN_ROOM';
    data: {
        roomCode: string;
        user: IUser;
    };
    timestamp: number;
}

export interface IJoinAckMessage {
    type: 'JOIN_ACK';
    data: {
        room: IRoom;
    };
    timestamp: number;
}

// types/chat-websocket.ts
import type { IMessage, IMessageContent } from '../models/message';

export interface IChatSendMessage {
    type: 'CHAT_SEND';
    data: {
        content: IMessageContent;
    };
    timestamp: number;
}

export interface IChatReceiveMessage {
    type: 'CHAT_RECEIVE';
    data: {
        message: IMessage;
    };
    timestamp: number;
}
```

### Define Data Models Matching Backend

```typescript
// models/room.ts
import type { IUser } from './user';

export enum ERoomStatus {
    Waiting = 'WAITING',
    Ready = 'READY',
    Closed = 'CLOSED',
}

export interface IParticipant {
    user: IUser;
    joinedAt: number;
}

export interface IRoom {
    roomId: string;
    roomCode: string;
    hostUserId: string;
    participants: IParticipant[];
    status: ERoomStatus;
    createdAt: number;
}

// models/user.ts
export interface IUser {
    userId: string;
    nickname: string;
}

// models/message.ts
import type { IUser } from './user';

export enum EMessageType {
    Text = 'TEXT',
}

export interface IMessageContent {
    type: EMessageType;
    text: string;
}

export interface IMessage {
    messageId: string;
    roomId: string;
    sender: IUser;
    type: EMessageType;
    content: IMessageContent;
    createdAt: number;
}
```

---

## Error Handling

**Reference**: [backend/docs/features/05-error-handling.md](../backend/docs/features/05-error-handling.md)

### WebSocket Error Codes

All error codes are defined by the backend. Handle them gracefully in the client.

| Error Code        | Description             | User Action               |
| ----------------- | ----------------------- | ------------------------- |
| `ROOM_NOT_FOUND`  | Room does not exist     | Check room code and retry |
| `ROOM_FULL`       | Room has 2 participants | Create a new room         |
| `ROOM_CLOSED`     | Room is closed          | Create a new room         |
| `ALREADY_JOINED`  | User already in room    | Refresh page              |
| `NOT_PARTICIPANT` | User not in room        | Join room first           |
| `ROOM_NOT_READY`  | Only 1 participant      | Wait for other player     |
| `INVALID_PAYLOAD` | Invalid message format  | Check message structure   |

### Handle Errors in WebSocketManager

Error handling is centralized in `WebSocketManager.handleErrorMessage()`. The manager displays user-friendly messages automatically.

**Example**:

```typescript
private handleErrorMessage(errorMessage: IWSErrorMessage): void {
    console.error('[WebSocket] Server error:', errorMessage.data);

    const { code, message } = errorMessage.data;

    const errorTexts: Record<string, string> = {
        ROOM_NOT_FOUND: '房间不存在',
        ROOM_FULL: '房间已满',
        ROOM_CLOSED: '房间已关闭',
        ALREADY_JOINED: '您已在房间中',
        NOT_PARTICIPANT: '您不是房间成员',
        ROOM_NOT_READY: '等待对方加入',
        INVALID_PAYLOAD: '消息格式错误',
    };

    wx.showToast({
        title: errorTexts[code] || message,
        icon: 'none',
        duration: 2000,
    });
}
```

### Connection Error Recovery

```typescript
Page({
    handleConnectionError() {
        wx.showModal({
            title: '连接错误',
            content: '网络连接出现问题，是否重新连接?',
            confirmText: '重新连接',
            success: res => {
                if (res.confirm) {
                    this.reconnectWebSocket();
                }
            },
        });
    },

    async reconnectWebSocket() {
        wx.showLoading({ title: '正在连接...' });

        try {
            await wsManager.connect({
                url: WS_URL,
                heartbeatInterval: 30000,
                reconnectInterval: 3000,
                maxReconnectAttempts: 5,
            });

            wx.hideLoading();
            wx.showToast({
                title: '连接成功',
                icon: 'success',
            });
        } catch (error) {
            wx.hideLoading();
            wx.showToast({
                title: '连接失败',
                icon: 'error',
            });
        }
    },
});
```

---

## WebSocket Best Practices

### Connection Management

- Connect on app launch (`App.onLaunch`)
- Maintain connection in background (`App.onHide`)
- Disconnect on app unload (`App.onUnload`)
- Implement automatic reconnection (max 5 attempts)
- Send heartbeat messages every 30 seconds

### Message Handling

- Use typed message interfaces matching backend specification
- Register handlers in `Page.onLoad`, unregister in `Page.onUnload`
- Handle `ERROR` messages centrally in WebSocketManager
- Log all messages for debugging (with `[WebSocket]` prefix)

### Data Synchronization

- **Server Authority**: Trust server-generated data (messageId, createdAt, timestamps)
- **Client Simplicity**: Send minimal data, receive complete data
- **Broadcast Pattern**: All participants receive the same message (including sender)

**Example**:

```typescript
// ✅ GOOD: Client sends minimal data
wsManager.send('CHAT_SEND', {
    content: { type: 'TEXT', text: 'Hello' },
});

// ✅ GOOD: Server broadcasts complete data to all
handleChatReceive(message: IChatReceiveMessage) {
    // message.data.message includes:
    // - messageId (server-generated UUID)
    // - createdAt (server timestamp)
    // - sender (complete user info)
    // - roomId (server authority)
}

// ❌ BAD: Don't generate messageId on client
const messageId = generateUUID();  // Server does this
```

### Room State Management

- Room status follows state machine: `WAITING` → `READY` → `CLOSED`
- `WAITING`: 1 participant (waiting for second player)
- `READY`: 2 participants (can send messages)
- `CLOSED`: Room ended (no new messages)

**Validation Rules**:

- Only send `CHAT_SEND` when room status is `READY`
- Show "waiting for player" message when status is `WAITING`
- Disable input when status is `CLOSED`

### Performance

- Batch UI updates with `setData` when possible
- Avoid excessive logging in production
- Use efficient data structures for message lists

### Security

- Use WSS (secure WebSocket) protocol in production
- Never send sensitive data unencrypted
- Validate all incoming messages before processing
- Don't trust client timestamps (use server timestamps)

---

## Room Creation Flow (HTTP + WebSocket)

**Reference**: [backend/docs/features/01-room-creation.md](../backend/docs/features/01-room-creation.md)

1. **Create Room (HTTP POST)**
    - Client: `POST /room/create` with creator info
    - Server: Returns `roomId` and `roomCode`

2. **Join Room (WebSocket)**
    - Client: Connect to WebSocket
    - Client: Send `JOIN_ROOM` with roomCode
    - Server: Broadcast `JOIN_ACK` to all participants

3. **Wait for Second Player**
    - Room status: `WAITING`
    - Show "waiting for player" message

4. **Second Player Joins**
    - Server: Broadcast `JOIN_ACK` with status `READY`
    - Both clients: Navigate to chat room

5. **Chat Communication**
    - Both clients can send `CHAT_SEND`
    - Server broadcasts `CHAT_RECEIVE` to all

**Example Flow**:

```typescript
// pages/welcome/index.ts - Create Room
async handleCreateRoom() {
    const app = getApp<IAppOption>();

    // 1. HTTP: Create room
    const response = await roomService.createRoom({
        userId: app.globalData.userId,
        nickname: app.globalData.nickname,
    });

    const { roomId, roomCode } = response.room;

    // 2. Navigate to waiting room
    wx.navigateTo({
        url: `/pages/waiting-room/index?roomCode=${roomCode}`,
    });
}

// pages/waiting-room/index.ts - Join Room via WebSocket
onLoad(options: { roomCode: string }) {
    // 3. WebSocket: Join room
    wsManager.send('JOIN_ROOM', {
        roomCode: options.roomCode,
        user: {
            userId: app.globalData.userId,
            nickname: app.globalData.nickname,
        },
    });

    // 4. Wait for JOIN_ACK
    wsManager.on('JOIN_ACK', this.handleJoinAck);
}

handleJoinAck(message: IJoinAckMessage) {
    const { room } = message.data;

    if (room.status === 'READY') {
        // 5. Both players ready, navigate to chat
        wx.redirectTo({
            url: `/pages/chat-room/index?roomId=${room.roomId}`,
        });
    }
}
```

---

## WebSocket Checklist (For AI Tools)

Before implementing WebSocket features, ensure:

### Architecture

- [ ] WebSocketManager uses singleton pattern
- [ ] WebSocketManager located in `services/websocket-manager.ts`
- [ ] All message types match [backend/docs/api-specification.md](../backend/docs/api-specification.md)

### Connection

- [ ] Connection includes heartbeat mechanism (30s interval)
- [ ] Automatic reconnection is implemented (max 5 attempts, 3s interval)
- [ ] Connection state is tracked and displayed to user
- [ ] WebSocket URL from config: `ws://localhost:8080/ws` (dev)

### Message Handling

- [ ] Message handlers are properly typed (see Type Definitions section)
- [ ] Handlers registered in `onLoad`, unregistered in `onUnload`
- [ ] `ERROR` messages handled centrally in WebSocketManager
- [ ] All messages logged with `[WebSocket]` prefix

### Type Definitions

- [ ] `IWSMessage` base interface defined
- [ ] `IJoinRoomMessage` and `IJoinAckMessage` defined
- [ ] `IChatSendMessage` and `IChatReceiveMessage` defined
- [ ] `IWSErrorMessage` defined
- [ ] All types match backend specification exactly

### Data Models

- [ ] `IRoom` interface matches backend (roomId, roomCode, participants, status)
- [ ] `IUser` interface matches backend (userId, nickname)
- [ ] `IMessage` interface matches backend (messageId, sender, content, createdAt)
- [ ] `ERoomStatus` enum: WAITING, READY, CLOSED

### Error Handling

- [ ] All error codes handled: ROOM_NOT_FOUND, ROOM_FULL, ROOM_CLOSED, etc.
- [ ] User-friendly Chinese error messages
- [ ] Connection recovery with manual retry option
- [ ] Error logging includes error code and message

### Client-Server Contract

- [ ] Client sends minimal data (e.g., only content in CHAT_SEND)
- [ ] Client trusts server-generated data (messageId, createdAt, timestamps)
- [ ] Client handles broadcast messages (including sender's own messages)
- [ ] Client validates room status before sending messages

### Room Flow

- [ ] HTTP `POST /room/create` creates room
- [ ] WebSocket `JOIN_ROOM` joins room
- [ ] `JOIN_ACK` broadcast updates all participants
- [ ] Room status transitions: WAITING → READY → CLOSED
- [ ] Chat only allowed when status is READY

### Testing Checklist

- [ ] Test WebSocket connection on app launch
- [ ] Test automatic reconnection on network failure
- [ ] Test room creation and joining flow
- [ ] Test chat messaging (send and receive)
- [ ] Test error handling (invalid room code, room full, etc.)
- [ ] Test multiple participants (broadcast behavior)
- [ ] Test page navigation (handlers cleanup on unload)

---

## References

**MUST READ before implementing WebSocket features**:

1. [API Specification](../backend/docs/api-specification.md) - Complete API reference
2. [Room Creation](../backend/docs/features/01-room-creation.md) - HTTP room creation
3. [Join Room](../backend/docs/features/02-join-room.md) - WebSocket JOIN_ROOM flow
4. [Chat Messaging](../backend/docs/features/03-chat-messaging.md) - WebSocket CHAT_SEND/RECEIVE
5. [Connection Lifecycle](../backend/docs/features/04-connection-lifecycle.md) - Connection management
6. [Error Handling](../backend/docs/features/05-error-handling.md) - Error codes and handling

---

## Quick Reference

### Message Type Summary

| Type           | Direction       | Purpose                     | Reference                                                             |
| -------------- | --------------- | --------------------------- | --------------------------------------------------------------------- |
| `JOIN_ROOM`    | Client → Server | Join room via code          | [02-join-room.md](../backend/docs/features/02-join-room.md)           |
| `JOIN_ACK`     | Server → Client | Confirm join (broadcast)    | [02-join-room.md](../backend/docs/features/02-join-room.md)           |
| `CHAT_SEND`    | Client → Server | Send chat message           | [03-chat-messaging.md](../backend/docs/features/03-chat-messaging.md) |
| `CHAT_RECEIVE` | Server → Client | Receive message (broadcast) | [03-chat-messaging.md](../backend/docs/features/03-chat-messaging.md) |
| `ERROR`        | Server → Client | Error notification          | [05-error-handling.md](../backend/docs/features/05-error-handling.md) |

### Room Status State Machine

```
WAITING (1 participant)
   ↓ Second player joins
READY (2 participants) ← Can send CHAT_SEND
   ↓ Player leaves / Room closed
CLOSED (no new messages)
```

### File Structure

```
miniprogram/
├── services/
│   └── websocket-manager.ts        # Singleton WebSocket manager
├── types/
│   ├── websocket-common.ts         # Base message types
│   ├── room-websocket.ts           # JOIN_ROOM, JOIN_ACK types
│   └── chat-websocket.ts           # CHAT_SEND, CHAT_RECEIVE types
├── models/
│   ├── room.ts                     # IRoom, ERoomStatus, IParticipant
│   ├── user.ts                     # IUser
│   └── message.ts                  # IMessage, EMessageType, IMessageContent
└── constants/
    └── config.ts                   # WS_URL constant
```

---

**Remember**: These rules enforce the backend specification. Non-compliant implementations will fail integration testing.
