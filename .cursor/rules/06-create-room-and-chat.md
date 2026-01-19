This document is intended to be **authoritative** for Cursor / AI coding:
if generated code violates these rules, it is **wrong**.

---

# Realtime Room & Chat Backend Rules

**CRITICAL**
This project implements a **strict two-user room system** using **HTTP + WebSocket**.
All backend logic **must** follow the domain models, message protocols, and lifecycle rules defined in this document.

No simplifications, shortcuts, or implicit behaviors are allowed.

---

## 1. Project Scope & Constraints

The backend must support the following **complete user path**:

```
User enters app
→ Create room (HTTP)
→ Establish WebSocket
→ Join room via roomCode
→ Second user joins
→ Room becomes READY
→ Two users exchange messages
→ Users leave
→ Room is CLOSED and cleaned up
```

### Hard Constraints

- Each room supports **exactly 2 users maximum**
- Only **text chat** is supported
- Rooms are joined **only via roomCode**
- **HTTP** is used only for room creation
- **WebSocket** is the only real-time channel
- No authentication, login, token, or openId
- Users are **session-level identities only**

## 2. Core Architectural Principles

### 2.1 Domain vs Transport Separation

The system must strictly separate concerns:

- **Domain layer**
    - User
    - Room
    - Participant
    - Message

- **Transport layer**
    - HTTP DTOs
    - WebSocket messages

- **Runtime layer**
    - WebSocket connections
    - connectionId / socket instance

**Rule**
WebSocket connections are **never** stored in domain models.

### 2.2 Room as the Only Subscription Unit

- A room represents a **single broadcast scope**
- Users only receive messages from the room they joined
- Cross-room messaging is forbidden

**Rule**
All WebSocket broadcasts must be scoped to exactly one room.

### 2.3 Authoritative Server State

The server is the **single source of truth** for:

- Room existence
- Room status
- Participant list
- Message routing

Clients must **never infer state** locally.

## 3. Domain Model Rules

### 3.1 User Model Rules

```ts
interface User {
    userId: string;
    nickname: string;
}
```

Rules:

- `userId` is the **only trusted identifier**
- `nickname` is display-only
- User does **not** represent a database account
- User lifecycle exists only for the current session

### 3.2 Room Model Rules

```ts
interface Room {
    roomId: string;
    roomCode: string;
    participants: Participant[];
    status: ERoomStatus;
    createdAt: number;
}
```

Rules:

- `participants.length` must never exceed **2**
- Room does **not** store WebSocket or connection info
- Room state controls allowed operations

### 3.3 Participant Model Rules

```ts
interface Participant {
    user: User;
    joinedAt: number;
}
```

Rules:

- A participant represents **membership**, not connection
- Runtime connection metadata must live outside the domain

### 3.4 Message Model Rules

```ts
interface Message {
    messageId: string;
    roomId: string;
    sender: User;
    type: MessageType;
    content: MessageContent;
    createdAt: number;
}
```

Rules:

- Every message belongs to exactly one room
- Sender must be a participant of that room
- Message type must match its content

## 4. Room Lifecycle & State Machine

### 4.1 Room Status Definitions

```ts
enum ERoomStatus {
    Waiting = 'WAITING',
    Ready = 'READY',
    Closed = 'CLOSED',
}
```

### 4.2 Allowed State Transitions

```
CREATE
  ↓
WAITING (1 participant)
  ↓ join
READY (2 participants)
  ↓ all leave / timeout
CLOSED
```

### 4.3 State-Based Behavior Constraints

| Room Status | Join Allowed | Chat Allowed | Notes                  |
| ----------- | ------------ | ------------ | ---------------------- |
| WAITING     | NO           | NO           | Only 1 participant     |
| READY       | NO           | YES          | Exactly 2 participants |
| CLOSED      | NO           | NO           | Terminal state         |

**Rule**
Any action violating the current room status must be rejected.

## 5. HTTP API Rules (Resource Layer)

### 5.1 Base Response Contract

```ts
interface BaseResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        code: EHttpErrorCode;
        message?: string;
    };
}
```

Rules:

- Either `data` or `error` must be present
- Never return partial success

### 5.2 Create Room Endpoint

**Endpoint**

```
POST /room/create
```

**Request**

```ts
interface CreateRoomRequest {
    creator: User;
}
```

**Server Responsibilities**

- Generate `roomId` and `roomCode`
- Create room with:
    - status = WAITING
    - participants = [creator]

- Persist room state

**Failure Rules**

- On failure, return `ROOM_CREATE_FAILED`
- No room should be partially created

## 6. WebSocket Communication Rules

### 6.1 WebSocket Responsibility Scope

WebSocket is responsible for:

- Joining rooms
- Broadcasting messages
- Handling disconnects
- Sending protocol-level errors

WebSocket is **not** responsible for room creation.

### 6.2 Message Direction Conventions

- **Client → Server**
    - Intent-based requests (join, send message)

- **Server → Client**
    - State confirmations
    - Broadcast messages
    - Errors

## 7. WebSocket Message Types

### 7.1 JOIN_ROOM (Client → Server)

Purpose: request to join a room using a roomCode.

**Validations (in order)**

1. Payload schema is valid
2. Room exists
3. Room status allows joining
4. Room is not full
5. User is not already a participant

**On Failure**

- Send `ERROR` with appropriate `EWSErrorCode`
- Do not mutate room state

### 7.2 JOIN_ACK (Server → Client)

Purpose: authoritative confirmation of room join.

**Rules**

- Must be sent after every successful JOIN
- Must include:
    - roomId
    - roomCode
    - full participant list
    - current room status

- Must be sent to **all participants**

### 7.3 CHAT_SEND (Client → Server)

Purpose: send a chat message.

**Preconditions**

- User has successfully joined a room
- Room status is `READY`

**Validations**

- Payload schema valid
- Message content matches type
- Sender is a participant

### 7.4 CHAT_RECEIVE (Server → Client)

Purpose: broadcast chat messages.

**Rules**

- Sent only after server validation
- Sent to all participants in the room
- Order must follow server receive order

### 7.5 ERROR (Server → Client)

Purpose: signal protocol or domain failure.

**Rules**

- Must include a valid `EWSErrorCode`
- Must not change room state
- Client must treat error as authoritative

## 8. WebSocket Error Handling Strategy

### 8.1 Protocol-Level Errors

- Invalid payload
- Missing required fields
- Unknown message type

→ `INVALID_PAYLOAD`

### 8.2 Domain-Level Errors

- Room not found → `ROOM_NOT_FOUND`
- Room full → `ROOM_FULL`
- Invalid room state → `ERROR`

### 8.3 Error Propagation Rules

- Errors are sent only to the requesting client
- Other participants are not notified unless state changes

## 9. Connection & Session Management

### 9.1 Connection Lifecycle

- Connection established
- User joins room via JOIN_ROOM
- Connection bound to (userId, roomId)
- Messages routed based on room

### 9.2 User Disconnect Behavior

On WebSocket disconnect:

- Remove participant from room
- If room becomes empty:
    - Transition room to CLOSED

- If one user remains:
    - Room must not revert to WAITING
    - Only eventual cleanup is allowed

## 10. Room Closure & Cleanup Rules

### 10.1 When a Room Becomes CLOSED

- All participants have left
- Or server-defined timeout reached

Once CLOSED:

- No joins allowed
- No messages allowed
- Room state is terminal

### 10.2 Cleanup Responsibilities

- Remove runtime connection references
- Mark room eligible for GC
- Do not resurrect CLOSED rooms

---

## 11. Validation & Invariants (Must Always Hold)

- A room never has more than 2 participants
- A READY room never accepts JOIN
- A CLOSED room never processes messages
- All messages are scoped to exactly one room
- User identity is always based on `userId`

---

## 12. Implementation Checklist (For Cursor / AI)

Before code is considered correct:

- [ ] Domain models contain no WebSocket logic
- [ ] Room lifecycle strictly enforced
- [ ] All WS messages validated before handling
- [ ] JOIN_ACK is the only source of room truth
- [ ] Disconnects deterministically update room state
- [ ] Errors are explicit and typed
