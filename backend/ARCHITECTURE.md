# Backend Architecture

This backend implements a **strict two-user chat room system** following the specifications in `.cursor/rules/06-create-room-and-chat.md`.

## Architecture Overview

### Core Principles

1. **Domain vs Transport Separation**: Business logic is separated from HTTP/WebSocket protocols
2. **Room-Based Broadcasting**: All messages are scoped to rooms
3. **Authoritative Server State**: Server is the single source of truth
4. **Strict Validation**: All operations validate state transitions

## Project Structure

```
backend/src/
├── models/                 # Domain Models (NO WebSocket logic)
│   ├── user.ts            # User identity
│   ├── room.ts            # Room + Participant + Status enum
│   └── message.ts         # Chat message
│
├── types/                  # Transport Layer Types
│   ├── http.ts            # HTTP DTOs and error codes
│   ├── ws-messages.ts     # WebSocket message types
│   └── common.ts          # Utility types
│
├── services/              # Business Logic Layer
│   ├── room-manager.ts    # Room lifecycle & state machine
│   ├── connection-manager.ts  # WebSocket connection management
│   └── handlers/          # WebSocket message handlers
│       ├── join-room-handler.ts
│       └── chat-send-handler.ts
│
├── constants/
│   └── config.ts          # Configuration constants
│
├── utils/
│   └── env-loader.ts      # Environment variable loading
│
├── app.ts                 # Express HTTP server
├── ws.ts                  # WebSocket server
└── index.ts               # Application entry point
```

## Domain Models

### User
```typescript
interface IUser {
    userId: string;      // Unique identifier
    nickname: string;    // Display name
}
```

### Room
```typescript
enum ERoomStatus {
    Waiting = 'WAITING',  // 1 participant
    Ready = 'READY',      // 2 participants (can chat)
    Closed = 'CLOSED',    // Terminal state
}

interface IRoom {
    roomId: string;
    roomCode: string;        // 6-digit code for joining
    participants: IParticipant[];  // MAX 2
    status: ERoomStatus;
    createdAt: number;
}
```

### Message
```typescript
interface IMessage {
    messageId: string;
    roomId: string;
    sender: IUser;
    type: EMessageType;
    content: MessageContent;
    createdAt: number;
}
```

## Communication Protocols

### HTTP API

Only one endpoint:

**POST /room/create**

Creates a new room with the creator as the first participant.

Request:
```json
{
    "creator": {
        "userId": "user_123",
        "nickname": "Alice"
    }
}
```

Response:
```json
{
    "success": true,
    "data": {
        "room": {
            "roomId": "room_abc123",
            "roomCode": "123456",
            "participants": [...],
            "status": "WAITING",
            "createdAt": 1234567890
        }
    }
}
```

### WebSocket Protocol

**Client → Server Messages:**

1. `JOIN_ROOM` - Join a room using roomCode
2. `CHAT_SEND` - Send a chat message

**Server → Client Messages:**

1. `JOIN_ACK` - Confirmation of join (sent to ALL participants)
2. `CHAT_RECEIVE` - Broadcast chat message
3. `ERROR` - Error notification

## Room Lifecycle

```
User 1 creates room via HTTP
        ↓
Room status: WAITING (1/2 participants)
        ↓
User 2 joins via WebSocket (roomCode)
        ↓
Room status: READY (2/2 participants)
        ↓
Both users can now chat
        ↓
User leaves
        ↓
Room status: CLOSED
```

## State Transitions

| Action | From State | To State | Notes |
|--------|-----------|----------|-------|
| Create Room | - | WAITING | Via HTTP, 1 participant |
| 2nd User Joins | WAITING | READY | Via WebSocket |
| All Leave | READY/WAITING | CLOSED | Room is deleted |

## Validation Rules

### JOIN_ROOM Validations (in order):
1. Payload schema is valid
2. Room exists
3. Room status is WAITING
4. Room is not full (< 2 participants)
5. User is not already a participant

### CHAT_SEND Validations:
1. User has joined a room
2. Room exists
3. Room status is READY
4. User is a participant
5. Content is valid

## Error Handling

All WebSocket errors use typed error codes:

```typescript
enum EWSErrorCode {
    InvalidPayload = 'INVALID_PAYLOAD',
    RoomNotFound = 'ROOM_NOT_FOUND',
    RoomFull = 'ROOM_FULL',
    RoomClosed = 'ROOM_CLOSED',
    NotParticipant = 'NOT_PARTICIPANT',
    RoomNotReady = 'ROOM_NOT_READY',
    AlreadyJoined = 'ALREADY_JOINED',
    InternalError = 'INTERNAL_ERROR',
}
```

## Running the Server

### Development
```bash
npm run dev
```

### Testing
```bash
# Run WebSocket test script
npm run ws:test
```

### Linting
```bash
npm run lint
npm run lint:fix
```

## Configuration

Environment variables (see `.env.example`):

```env
PORT=8080
WS_PATH=/ws
NODE_ENV=development
```

## Key Architectural Decisions

1. **No WebSocket in Domain Models**: Room, User, Message do not contain any WebSocket references
2. **Connection Manager**: Separate service manages runtime connection metadata
3. **State Machine Enforcement**: Room status transitions are strictly validated
4. **Broadcast Scoping**: All messages are scoped to exactly one room
5. **HTTP for Creation**: Room creation uses HTTP to ensure idempotency and proper error handling

## Future Enhancements

Potential features (not yet implemented):
- Message history persistence
- Room timeout cleanup
- User authentication
- File/image messages
- Read receipts
- Typing indicators

---

For detailed rules and constraints, see `.cursor/rules/06-create-room-and-chat.md`
