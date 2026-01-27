# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Two-player real-time interactive WeChat Mini Program ("申冤" app) with a Node.js backend. Users create/join rooms, compete in a drum-tapping game to decide speaking order, then take turns voicing grievances.

**User Flow**: Welcome → Waiting Room → Drum Room (10s tap competition) → Chat Room (turn-based voice chat)

**Tech Stack**:

- **Frontend**: WeChat Mini Program native framework (TypeScript, WXML, WXSS)
- **Backend**: Node.js + Express + WebSocket (ws library) + Zod validation

## Development Commands

### Frontend (root directory)

```bash
npm install            # Install dependencies
npm run prepare        # Initialize Husky git hooks
npm run lint           # Check code with ESLint
npm run lint:fix       # Auto-fix ESLint issues
npm run format         # Format code with Prettier
```

### Backend (backend/ directory)

```bash
cd backend
npm install            # Install dependencies
npm run dev            # Start dev server (ts-node with watch)
npm run build          # Compile TypeScript to dist/
npm start              # Run production build
npm run ws:test        # Test WebSocket connection
npm run lint           # Check code with ESLint
npm run lint:fix       # Auto-fix ESLint issues
npm run format         # Format code with Prettier
```

## Development Environment

- **Frontend Tool**: WeChat DevTools (微信开发者工具) - required to run/preview
- **Backend**: `http://localhost:8080`, WebSocket at `ws://localhost:8080/ws`
- **Node.js**: >= 14.0.0
- **Frontend Entry**: `miniprogram/` directory
- **Backend Entry**: `backend/src/index.ts`

## Architecture

### Frontend Structure (miniprogram/)

```
miniprogram/
├── app.ts              # App entry with App<IAppOption>()
├── pages/              # welcome/, waiting-room/, drum-room/, chat-room/
├── components/         # styled-button/, styled-title/, countdown/
├── services/           # Business logic (room-service, websocket-manager, drum-service, chat-service)
├── models/             # Domain interfaces (IUser, IRoom, IMessage)
├── types/              # API/WebSocket contract types
├── constants/          # Centralized config
└── utils/              # Pure utility functions (audio, haptic, random, time)
```

### Backend Structure (backend/src/)

```
backend/src/
├── routes/             # HTTP route definitions
├── controllers/        # Request/response handling (room-controller, ws-controller)
├── services/           # Business logic
│   ├── core/           # Room CRUD operations
│   ├── websocket/      # Connection, room, and drum game managers
│   └── handlers/       # Message handlers (join-room, chat-send, drum-tap)
├── models/
│   ├── entities/       # Domain entities (room, user, message)
│   ├── dto/            # Request/response DTOs
│   └── schemas/        # Zod validation schemas
├── middlewares/        # validation/, error/, logging/
├── types/              # TypeScript type definitions (http/, websocket/)
└── utils/              # Helper functions
```

### Separation of Concerns

- **Pages/Controllers**: UI/request handling only - delegate to services
- **Services**: Business rules, API communication, data processing
- **Utils**: Pure functions, no side effects, easily testable
- **Repositories**: Data access abstraction (backend)

### Key Frontend Patterns

- **App**: `App<IAppOption>()` in `app.ts` with `globalData` for shared state
- **Page**: `Page()` with lifecycle (onLoad, onShow, onReady, onHide, onUnload)
- **Data Binding**: One-way via `this.setData()` - always batch updates when possible
- **Navigation**: `wx.navigateTo()` (with back), `wx.redirectTo()` (replaces), `wx.switchTab()` (tab bar)

## Critical Constraints

### Animation - MANDATORY

All animations MUST use `wx.createAnimation()` API. **CSS animations/transitions are FORBIDDEN**:

```typescript
const animation = wx.createAnimation({
    duration: 1000,
    timingFunction: 'ease',
});
animation.translateX(100).step();
this.setData({ animationData: animation.export() });
```

In WXML: `<view animation="{{ animationData }}"></view>`

### TypeScript - MANDATORY

- **No `any` types** - Use `unknown` with type guards instead
- **Explicit types on all variables** - Every variable declaration must have an explicit type annotation
- **Explicit types on all function parameters and return types** - Every function must specify types for all parameters and return value
- **Interface prefix**: `I` (e.g., `IUser`, `IPageData`)
- **Unused code**: Prefix intentionally unused params with `_`
- **WeChat types**: Use `WechatMiniprogram` namespace
- **Object parameters for 3+ arguments** - Functions with 3 or more parameters must use a single options object

```typescript
// Correct
const count: number = 0;
const name: string = 'user';
function add(a: number, b: number): number {
    return a + b;
}

// Wrong - missing type annotations
const count = 0;
function add(a, b) {
    return a + b;
}
```

### Code Style

- 4 spaces indentation
- Single quotes
- Semicolons required
- 80 character line width

### Pre-commit Hooks

Husky + lint-staged auto-runs on commit:

- ESLint + Prettier on `.ts`, `.js`, `.json`, `.md`
- Commit blocked if unfixable errors exist

## WXML/WXSS Patterns

### WXML

- Use `wx:key` with unique identifiers (not index) for `wx:for`
- Use `data-*` attributes for event data, access via `event.currentTarget.dataset`
- Keep logic in TypeScript, not templates
- Use `wx:if` for rare toggles (removes from DOM), `hidden` for frequent toggles

### WXSS

- Use `rpx` for responsive sizing (750rpx = screen width), `px` only for borders
- Use BEM naming: `.block__element--modifier`
- Global styles in `app.wxss`, page-specific in page `.wxss`
- **No `!important`** - Fix specificity issues properly
- Use Flexbox for layouts (default in WeChat Mini Program)

## WebSocket Pattern

### Frontend (singleton WebSocketManager in `services/websocket-manager.ts`)

- Heartbeat mechanism (30s interval) to keep connection alive
- Automatic reconnection (max 5 attempts, 3s interval)
- Register handlers in `onLoad`, unregister in `onUnload`
- Use WSS (secure WebSocket) protocol in production

### Backend Message Protocol

**Client → Server**:
| Type | Description |
|------|-------------|
| `JOIN_ROOM` | Join a room via room code |
| `DRUM_TAP` | Record drum tap during game |
| `CHAT_SEND` | Send a chat message |

**Server → Client**:
| Type | Description |
|------|-------------|
| `JOIN_ACK` | Confirm room join (broadcast) |
| `DRUM_READY` | Both players ready for drum game |
| `DRUM_START` | Drum game starts |
| `DRUM_TAP` | Tap count update |
| `DRUM_FINISH` | Drum game ends |
| `DRUM_RESULT` | Final game results |
| `CHAT_RECEIVE` | Receive chat message (broadcast) |
| `ERROR` | Error notification |

### Room Flow

1. Creator calls `POST /room/create` → gets `roomCode`
2. Both users connect via WebSocket, send `JOIN_ROOM` with `roomCode`
3. When 2 users join, room becomes `READY`
4. Room states: `WAITING` (1 person) → `READY` (2 people) → `CLOSED`

### Error Codes

| Code              | Chinese Message |
| ----------------- | --------------- |
| `ROOM_NOT_FOUND`  | 房间不存在      |
| `ROOM_FULL`       | 房间已满        |
| `ROOM_CLOSED`     | 房间已关闭      |
| `ALREADY_JOINED`  | 您已在房间中    |
| `NOT_PARTICIPANT` | 您不是房间成员  |
| `ROOM_NOT_READY`  | 等待对方加入    |
| `INVALID_PAYLOAD` | 消息格式错误    |

## Type Definitions

- **Frontend custom types**: `miniprogram/types/` directory
- **WeChat API types**: `miniprogram-api-typings` package, use `WechatMiniprogram` namespace
- **Backend types**: `backend/src/types/` (http/, websocket/)
- **Validation schemas**: `backend/src/models/schemas/` using Zod

### Key Interfaces

```typescript
// Frontend models (miniprogram/models/)
interface IUser {
    userId: string;
    nickname: string;
}

interface IRoom {
    roomId: string;
    roomCode: string;
    hostUserId: string;
    participants: IParticipant[];
    status: ERoomStatus; // WAITING | READY | CLOSED
}

interface IMessage {
    messageId: string;
    roomId: string;
    sender: IUser;
    type: EMessageType;
    content: IMessageContent;
    createdAt: number;
}
```

## SOLID Principles

- **Single Responsibility**: Each function/class does one thing well
- **Open/Closed**: Use interfaces for extension without modification
- **Interface Segregation**: Small, focused interfaces (e.g., separate IWebSocketLifecycle, IWebSocketMessageHandler)
- **Dependency Inversion**: Depend on abstractions (interfaces), not concretions

## Backend API Documentation

See `backend/docs/` for detailed API specifications:

- `api-specification.md` - Complete API reference
- `features/01-room-creation.md` - HTTP room creation
- `features/02-join-room.md` - WebSocket JOIN_ROOM flow
- `features/03-chat-messaging.md` - WebSocket CHAT_SEND/RECEIVE
- `features/04-connection-lifecycle.md` - Connection management
- `features/05-error-handling.md` - Error codes and handling
