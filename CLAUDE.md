# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Reference - Critical Rules

| Rule           | Requirement                                                    |
| -------------- | -------------------------------------------------------------- |
| **Animation**  | `wx.createAnimation()` ONLY - CSS animations FORBIDDEN         |
| **TypeScript** | NO `any` - explicit types on ALL variables, params, returns    |
| **Styles**     | Use `rpx` units (750rpx = screen width), `px` for borders only |
| **Lists**      | `wx:key` with unique ID required (not index)                   |
| **Imports**    | Relative paths only (`@/` aliases FORBIDDEN by ESLint)         |

## Project Overview

Two-player real-time interactive WeChat Mini Program ("申冤" app) with a Node.js backend. Users create/join rooms, compete in a drum-tapping game to decide speaking order, then take turns voicing grievances with real-time ASR transcription.

**User Flow**: Welcome → Waiting Room → Drum Room (10s tap competition) → Chat Room (turn-based voice chat with ASR)

**Tech Stack**:

- **Frontend**: WeChat Mini Program native framework (TypeScript, WXML, WXSS) with `glass-easel` component framework
- **Backend**: Node.js + Express + WebSocket (ws library) + Zod validation
- **ASR**: Tencent Cloud `QCloudAIVoice` plugin (frontend) + STS token service (backend)

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
npm run dev            # Start dev server (tsx watch, hot reload)
npm run build          # Compile TypeScript to dist/
npm start              # Run production build (dist/index.js)
npm run ws:test        # Test WebSocket connection
npm run lint           # Check code with ESLint
npm run lint:fix       # Auto-fix ESLint issues
npm run format         # Format code with Prettier
npm run format:check   # Check formatting without writing
npx tsc --noEmit       # Type check without emitting
```

## Development Environment

- **Frontend Tool**: WeChat DevTools (微信开发者工具) - required to run/preview
- **Backend**: `http://localhost:8080`, WebSocket at `ws://localhost:8080/ws`
- **Node.js**: >= 14.0.0
- **Frontend Entry**: `miniprogram/` directory
- **Backend Entry**: `backend/src/index.ts`
- **Frontend Config**: Auto-detects devtools vs real device in `constants/config.ts` (localhost for devtools, LAN IP for real device)

## Architecture

### Frontend Structure (miniprogram/)

Uses subpackage loading for optimized bundle sizes:

| Package  | Root              | Pages                     | Purpose                    |
| -------- | ----------------- | ------------------------- | -------------------------- |
| Main     | `pages/`          | welcome/                  | Entry page (always loaded) |
| packageA | `packageA/pages/` | waiting-room/, drum-room/ | Room creation and game     |
| packageB | `packageB/pages/` | chat-room/                | Voice chat with ASR        |

### Frontend Services (all singletons)

All services are classes exported as singleton instances:

| Service                  | Export        | Purpose                                     |
| ------------------------ | ------------- | ------------------------------------------- |
| `websocket-manager`      | `wsManager`   | WebSocket connection lifecycle (shared bus) |
| `room-service`           | `roomService` | Room creation via HTTP API                  |
| `room-websocket-service` | (see file)    | Room join/leave via WebSocket               |
| `drum-service`           | `drumService` | Drum game message sending/receiving         |
| `chat-service`           | (see file)    | Chat message handling                       |
| `asr-service`            | `asrService`  | ASR text sync via WebSocket (throttled)     |
| `sts-service`            | (see file)    | Tencent Cloud STS token fetching            |

### Dual Type System for WebSocket Messages

The frontend uses **two separate type hierarchies** for WebSocket messages:

1. **General messages** (`types/websocket-common.ts`): `EWSMessageType` + `IWSMessage<T>` — for `JOIN_ROOM`, `CHAT_SEND`, `ASR_TEXT_PUSH`, etc.
2. **Drum messages** (`types/drum-websocket.ts`): `EDrumMessageType` + `IDrumMessage<T>` — for `DRUM_READY`, `DRUM_START`, `DRUM_TAP`, `DRUM_FINISH`, `DRUM_RESULT`

The backend uses a single unified `EWSMessageType` enum for all message types.

### Cross-Page Message Queue Pattern

`DrumService` implements an early-listening pattern for messages that arrive between page navigations:

1. `startListening()` called from waiting-room when room becomes `READY` — registers WebSocket handler
2. Messages (`DRUM_READY`, `DRUM_START`) are queued with `receivedAtMs` timestamps
3. `initialize()` called from drum-room `onLoad` — processes queued messages with original timestamps for accurate time sync

### Backend Structure (backend/src/)

Three-layer architecture: Routes → Controllers → Services → (Repositories)

**HTTP flow**: `routes/` → `controllers/` → `services/core/` → `services/websocket/room-manager.ts`

**WebSocket flow**: `ws.ts` → `controllers/ws-controller.ts` → `services/handlers/` → `services/websocket/`

Storage is currently in-memory via `room-manager.ts` (MongoDB config is stubbed but not active).

### Separation of Concerns

- **Pages/Controllers**: UI/request handling only — delegate to services
- **Services**: Business rules, API communication, data processing
- **Utils**: Pure functions, no side effects, easily testable

### Key Frontend Patterns

- **App**: `App<IAppOption>()` in `app.ts` with `globalData` for shared state
- **Page**: `Page()` with lifecycle (onLoad, onShow, onReady, onHide, onUnload)
- **Data Binding**: One-way via `this.setData()` — always batch updates when possible
- **Navigation**: `wx.navigateTo()` (with back), `wx.redirectTo()` (replaces), `wx.switchTab()` (tab bar)

## Critical Constraints

### Animation - MANDATORY

All animations MUST use `wx.createAnimation()` API. **CSS animations/transitions are FORBIDDEN**:

```typescript
// In TypeScript
const animation = wx.createAnimation({
    duration: 1000,
    timingFunction: 'ease',
});
animation.translateX(100).step();
this.setData({ animationData: animation.export() });
```

```xml
<!-- In WXML -->
<view animation="{{ animationData }}"></view>
```

### TypeScript - MANDATORY

- **No `any` types** — Use `unknown` with type guards instead
- **Explicit types required** — All variables, function parameters, and return types
- **Naming conventions**: Interface prefix `I` (e.g., `IUser`), Enum prefix `E` (e.g., `ERoomStatus`)
- **Unused code**: Prefix intentionally unused params with `_`
- **WeChat types**: Use `WechatMiniprogram` namespace
- **3+ parameters**: Use a single options object

```typescript
// Correct
const count: number = 0;
function add(a: number, b: number): number {
    return a + b;
}

// Wrong - missing type annotations (will fail ESLint)
const count = 0;
function add(a, b) {
    return a + b;
}
```

### Code Style

- 4 spaces indentation, single quotes, semicolons required, 80 char line width
- **Import ordering** (enforced by ESLint `import/order`): builtin → external → internal → parent → sibling → index, with newlines between groups, alphabetized within groups
- **No `@/` alias imports** — use relative paths only (enforced by `no-restricted-imports` rule)

### Pre-commit Hooks

Husky + lint-staged runs ESLint + Prettier on `.ts`, `.js`, `.json`, `.md`. Commit blocked if unfixable errors exist.

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
- **No `!important`** — Fix specificity issues properly
- Use Flexbox for layouts (default in WeChat Mini Program)

## WebSocket Pattern

### Frontend (singleton WebSocketManager in `services/websocket-manager.ts`)

- Heartbeat mechanism (30s interval) to keep connection alive
- Automatic reconnection (max 5 attempts, 3s interval)
- Single shared connection — services register via `wsManager.updateCallbacks()`
- Each service (drum, chat, ASR) overwrites the `onMessage` callback when active, so only one message handler is active at a time

### Backend Message Protocol

**Client → Server**:

| Type            | Description                                                         |
| --------------- | ------------------------------------------------------------------- |
| `JOIN_ROOM`     | Join a room via room code                                           |
| `DRUM_TAP`      | Record drum tap during game                                         |
| `CHAT_SEND`     | Send a chat message                                                 |
| `ASR_TEXT_PUSH` | Push ASR transcription text (throttled partials + immediate finals) |

**Server → Client**:

| Type           | Description                                               |
| -------------- | --------------------------------------------------------- |
| `JOIN_ACK`     | Confirm room join (broadcast)                             |
| `DRUM_READY`   | Both players ready for drum game                          |
| `DRUM_START`   | Drum game starts (includes `startAtMs` timing)            |
| `DRUM_TAP`     | Tap count update (forwarded to opponent)                  |
| `DRUM_FINISH`  | Drum game ends                                            |
| `DRUM_RESULT`  | Final game results (scores + winner)                      |
| `CHAT_RECEIVE` | Receive chat message (broadcast)                          |
| `ASR_TEXT`     | ASR transcription result (broadcast to other participant) |
| `ERROR`        | Error notification                                        |

### Room Flow

1. Creator calls `POST /room/create` → gets `roomCode`
2. Both users connect via WebSocket, send `JOIN_ROOM` with `roomCode`
3. When 2 users join, room becomes `READY`
4. After `WAITING_ROOM_CONFIG.COUNTDOWN_MS` (3s), drum game auto-starts
5. Room states: `WAITING` (1 person) → `READY` (2 people) → `CLOSED`

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
| `INTERNAL_ERROR`  | 服务器内部错误  |

## HTTP Endpoints

| Method | Path                   | Description                                       |
| ------ | ---------------------- | ------------------------------------------------- |
| GET    | `/health`              | Health check                                      |
| POST   | `/room/create`         | Create a new room (returns `roomId` + `roomCode`) |
| GET    | `/tencent/credentials` | Get Tencent Cloud STS token for client-side ASR   |

## Backend Environment Variables

Required environment variables (see `backend/.env.example`):

```bash
PORT=8080
NODE_ENV=development
WS_PATH=/ws
TENCENT_SECRET_ID=your_secret_id      # Required for ASR service
TENCENT_SECRET_KEY=your_secret_key    # Required for ASR service
TENCENT_REGION=ap-guangzhou           # Required for ASR service
```

## Backend Docker

```bash
docker-compose up -d                   # Development (hot reload)
docker build -t chatroom-backend:latest -f backend/Dockerfile backend/  # Production build
```

## Type Definitions

- **Frontend custom types**: `miniprogram/types/` directory
- **WeChat API types**: `miniprogram-api-typings` package, use `WechatMiniprogram` namespace
- **Backend types**: `backend/src/types/` (http/, websocket/)
- **Validation schemas**: `backend/src/models/schemas/` using Zod
- **Key models**: See `miniprogram/models/` for `IUser`, `IRoom`, `IMessage` interfaces

## Adding New WebSocket Message Types

1. Define types in `backend/src/types/websocket/` (create new file or extend existing)
2. Export from `backend/src/types/websocket/index.ts`
3. Add message type to `EWSMessageType` enum in `backend/src/types/websocket/base.ts`
4. Create handler in `backend/src/services/handlers/`
5. Add case to switch in `WebSocketController.handleMessage()`
6. Add Zod schema in `backend/src/models/schemas/`
7. Add corresponding frontend types in `miniprogram/types/`

## Design Principles

- **Single Responsibility**: Each function/class does one thing well
- **Separation of Concerns**: Pages handle UI only; delegate business logic to services
- **Interface Segregation**: Small, focused interfaces (e.g., separate IWebSocketLifecycle, IWebSocketMessageHandler)
- **Dependency Inversion**: Depend on abstractions (interfaces), not concretions

## Additional Documentation

- **Backend-specific**: See `backend/CLAUDE.md` for backend architecture, WebSocket message types, and API details
- **API Specification**: See `backend/docs/` for detailed API specifications
