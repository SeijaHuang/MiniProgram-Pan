# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Node.js backend for a two-player real-time chat room system ("申冤" app). Uses HTTP for room creation and WebSocket for real-time communication including room joining, drum game, ASR text sync, and chat messaging. See `../CLAUDE.md` for full project context including frontend.

## Development Commands

```bash
npm run dev           # Start dev server (tsx watch, hot reload)
npm run build         # Compile TypeScript to dist/
npm start             # Run production build (dist/index.js)
npm run lint          # ESLint check
npm run lint:fix      # ESLint auto-fix
npm run format        # Prettier format
npm run format:check  # Prettier check only
npx tsc --noEmit      # Type check without emitting
```

**Server**: `http://localhost:8080`, WebSocket at `ws://localhost:8080/ws`

**Docker**:
```bash
docker-compose up -d                    # Dev with hot reload
docker build -t chatroom-backend .      # Production build
```

**No test framework is installed.** `npm run ws:test` references a missing script file.

## Architecture

Three-layer architecture: Routes → Controllers → Services

### Request Flow

**HTTP**: `routes/` → `controllers/` → `services/core/` → `services/websocket/room-manager.ts`

**WebSocket**: `ws.ts` assigns connectionId → `WebSocketController.handleMessage()` switches on `message.type` → calls handler in `services/handlers/` → handler uses managers in `services/websocket/` → controller broadcasts response via `connectionManager`

### Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Entry point, creates HTTP server, calls `initWebSocket()` |
| `src/app.ts` | Express app — only `express.json()` middleware + routes |
| `src/ws.ts` | WebSocket init, assigns `conn_*` IDs, delegates to controller |
| `src/controllers/ws-controller.ts` | Central message router (439 lines) — routes messages AND orchestrates drum game timing |
| `src/services/websocket/connection-manager.ts` | Maps connectionId ↔ userId ↔ roomId, handles broadcast |
| `src/services/websocket/room-manager.ts` | In-memory room state machine |
| `src/services/websocket/drum-game-manager.ts` | Drum game phase/score tracking |
| `src/services/handlers/asr-text-handler.ts` | ASR text sync with deduplication and throttling (334 lines) |
| `src/constants/config.ts` | All timing/size constants |

### Singleton Pattern

All managers use a singleton pattern with exported instances:
```typescript
export class ConnectionManager {
    private static instance: ConnectionManager;
    static getInstance(): ConnectionManager { ... }
}
export const connectionManager = ConnectionManager.getInstance();
```

Import the pre-created instance, not the class: `import { connectionManager } from '...'`

### Drum Game Orchestration

The drum game flow is orchestrated by `WebSocketController` (not a handler), using `setTimeout` chains:

1. Room reaches `READY` → `WAITING_ROOM_CONFIG.COUNTDOWN_MS` delay
2. `DRUM_READY` broadcast → `DRUM_START` broadcast with timing
3. `DRUM_CONFIG.COUNTDOWN_MS` later → phase becomes `Running`
4. `DRUM_CONFIG.GAME_DURATION_MS` later → `DRUM_FINISH` → `DRUM_RESULT` → cleanup

### Validation Pattern

Controllers validate inline using Zod (middleware validators exist in `middlewares/validation/` but are **not registered** in `app.ts`):

```typescript
const validation = Schema.safeParse(data);
if (!validation.success) {
    return { success: false, code: EWSErrorCode.InvalidPayload, ... };
}
const { field1, field2 } = validation.data; // Type-safe
```

Schemas are in `src/models/schemas/`: `http-request.schema.ts`, `ws-message.schema.ts`, `drum-message.schema.ts`, `ws-asr-text-push.schema.ts`

### Stubs / Not Yet Implemented

- **Database**: MongoDB config in `src/database/` — stubbed, not connected. All storage is in-memory via `room-manager.ts`
- **Repository layer**: Interfaces in `src/repositories/` — defined but no implementations
- **room-crud.service.ts**: All methods throw "Not implemented"
- **Middleware**: Error handler, request logger, and validation middleware are defined in `src/middlewares/` but **not used** by `app.ts`

## Adding New WebSocket Message Types

1. Define types in `src/types/websocket/` (new file or extend existing)
2. Export from `src/types/websocket/index.ts`
3. Add to `EWSMessageType` enum in `src/types/websocket/base.ts`
4. Add Zod schema in `src/models/schemas/`
5. Create handler in `src/services/handlers/`
6. Add case to `WebSocketController.handleMessage()` switch
7. Add broadcast/response logic in the controller method

## WebSocket Message Protocol

**Client → Server**: `JOIN_ROOM`, `CHAT_SEND`, `DRUM_TAP`, `ASR_TEXT_PUSH`

**Server → Client**: `JOIN_ACK`, `CHAT_RECEIVE`, `DRUM_READY`, `DRUM_START`, `DRUM_TAP`, `DRUM_FINISH`, `DRUM_RESULT`, `ASR_TEXT`, `ERROR`

All messages: `{ type: EWSMessageType, data: T, timestamp: number }`

## Room State Machine

```
POST /room/create → WAITING (1 participant)
                        ↓ (JOIN_ROOM from 2nd user)
                     READY (2 participants) → drum game after countdown
                        ↓
                     CLOSED (cleanup on disconnect)
```

Max 2 participants per room. ConnectionManager tracks `connectionId → { userId, roomId }` bindings and cleans up on disconnect.

## TypeScript Conventions

- **No `any`** — use `unknown` with type guards
- **Prefixes**: `I` for interfaces, `E` for enums, `T` for type aliases (e.g., `TJoinRoomHandlerResult`)
- **Unused params**: prefix with `_`
- **Explicit types** on all function parameters and return types
- **Code style**: 4 spaces, single quotes, semicolons, 80 char width, trailing comma ES5

## Configuration

Key constants in `src/constants/config.ts`:

| Constant | Default | Purpose |
|----------|---------|---------|
| `APP_CONFIG.PORT` | 8080 | HTTP/WS port |
| `WS_CONFIG.PATH` | `/ws` | WebSocket endpoint |
| `ROOM_CONFIG.MAX_PARTICIPANTS` | 2 | Max users per room |
| `WAITING_ROOM_CONFIG.COUNTDOWN_MS` | 3000 | Delay before drum game starts |
| `DRUM_CONFIG.COUNTDOWN_MS` | 3000 | Pre-game countdown |
| `DRUM_CONFIG.GAME_DURATION_MS` | 10000 | Game length |

## Environment Variables

Required (see `.env.example`):
```bash
PORT=8080
NODE_ENV=development
WS_PATH=/ws
TENCENT_SECRET_ID=...    # Required for ASR STS tokens
TENCENT_SECRET_KEY=...
TENCENT_REGION=ap-guangzhou
```

Note: `.env.example` contains additional unused variables (OpenAI, LLM Worker) — only the above are read by the code.

## HTTP Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/room/create` | Create room (body: `{ creator: { userId, nickname } }`) |
| GET | `/tencent/credentials` | Tencent Cloud STS token for client ASR |

## Error Codes (EWSErrorCode)

| Code | When |
|------|------|
| `ROOM_NOT_FOUND` | Room code doesn't exist |
| `ROOM_FULL` | Already 2 participants |
| `ROOM_CLOSED` | Room has been closed |
| `ALREADY_JOINED` | User already in this room |
| `NOT_PARTICIPANT` | User not a room member |
| `ROOM_NOT_READY` | Only 1 person in room |
| `INVALID_PAYLOAD` | Malformed message / Zod validation failure |
| `INTERNAL_ERROR` | Server error |
