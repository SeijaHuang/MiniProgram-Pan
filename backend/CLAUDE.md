# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Node.js backend for a two-player real-time chat room system ("申冤" app). Uses HTTP for room creation and WebSocket for real-time communication including room joining, drum game, ASR text sync, chat messaging, and AI verdict delivery. See `../CLAUDE.md` for full project context including frontend.

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

**HTTP (Room)**: `routes/` → `controllers/` → `services/core/` → `services/websocket/room-manager.ts`

**HTTP (LLM)**: `routes/llm-judgement.routes.ts` → `controllers/llm-judgement.controller.ts` → `services/core/llm-judgement.service.ts` → `clients/openai.client.ts`

**HTTP (Verdict fallback)**: `routes/verdict-routes.ts` → `controllers/verdict-http.controller.ts` → `services/websocket/room-manager.ts` (cached result)

**WebSocket**: `ws.ts` assigns connectionId → `WebSocketController.handleMessage()` switches on `message.type` → calls handler in `services/handlers/` → handler uses managers in `services/websocket/` → controller broadcasts response via `connectionManager`

**WebSocket (Verdict)**: `SPEECH_TURN_END` → `speech-turn-end-handler` → when both finished → broadcast `CHAT_COMPLETE` → async `verdict-orchestrator.service.ts` → `llm-judgement.service` → `openai.client` → `verdict-mapper.service` → broadcast `VERDICT_RESULT` or `VERDICT_FAILED`

### Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Entry point, creates HTTP server, calls `initWebSocket()` |
| `src/app.ts` | Express app — only `express.json()` middleware + routes |
| `src/ws.ts` | WebSocket init, assigns `conn_*` IDs, delegates to controller |
| `src/controllers/ws-controller.ts` | Central message router — routes messages AND orchestrates drum game timing + verdict generation |
| `src/controllers/verdict-http.controller.ts` | GET /v1/rooms/:roomId/verdict — fallback to fetch cached verdict |
| `src/services/core/verdict-orchestrator.service.ts` | Async verdict generation (LLM call + mapping + WS push) |
| `src/services/core/verdict-mapper.service.ts` | Transform LLM response to frontend format (Chinese→English keys, player→host/guest) |
| `src/services/handlers/speech-turn-end-handler.ts` | Mark player speech turn as finished, detect bothFinished |
| `src/services/handlers/verdict-retry-handler.ts` | Validate retry count, reset verdict status |
| `src/services/websocket/connection-manager.ts` | Maps connectionId ↔ userId ↔ roomId, handles broadcast |
| `src/services/websocket/room-manager.ts` | In-memory room state machine |
| `src/services/websocket/drum-game-manager.ts` | Drum game phase/score tracking |
| `src/services/handlers/asr-text-handler.ts` | ASR text sync with deduplication, throttling, and Final text accumulation to speechState |
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

The drum game flow is orchestrated by `WebSocketController` (not a handler):

1. Room reaches `READY` → after `WAITING_ROOM_CONFIG.COUNTDOWN_MS` → broadcast `DRUM_READY` (player info + server time sync)
2. Each player sends `DRUM_START_REQUEST` → server broadcasts `DRUM_PLAYER_READY` (readyCount)
3. When both players ready → broadcast `DRUM_START` with `startAtMs` timing
4. `DRUM_CONFIG.GAME_DURATION_MS` (10s) later → `DRUM_FINISH` → `DRUM_RESULT` → cleanup

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

**Client → Server**: `JOIN_ROOM`, `DRUM_START_REQUEST`, `DRUM_TAP`, `CHAT_SEND`, `ASR_TEXT_PUSH`, `EMOJI_SEND`, `SPEECH_TURN_END`, `VERDICT_RETRY`, `POST_GAME_ACTION`, `LEAVE_ROOM`

**Server → Client**: `JOIN_ACK`, `DRUM_READY`, `DRUM_PLAYER_READY`, `DRUM_START`, `DRUM_TAP`, `DRUM_FINISH`, `DRUM_RESULT`, `CHAT_RECEIVE`, `ASR_TEXT`, `EMOJI_RECEIVE`, `SPEECH_TURN_SWITCH`, `CHAT_COMPLETE`, `VERDICT_RESULT`, `VERDICT_FAILED`, `POST_GAME_EFFECT`, `LEAVE_ROOM_ACK`, `ERROR`

All messages: `{ type: EWSMessageType, data: T, timestamp: number }`

## Room State Machine

```
POST /v1/rooms → WAITING (1 participant)
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
| POST | `/v1/rooms` | Create room (body: `{ creator: { userId, nickname } }`) |
| POST | `/v1/rooms/:roomId/judgments` | LLM judgment verdict (direct call) |
| GET | `/v1/rooms/:roomId/verdict` | Get cached verdict result (fallback) |
| GET | `/v1/tencent/credentials` | Tencent Cloud STS token for client ASR |

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

## LLM Judgement API (Synchronous)

Single endpoint — calls OpenAI directly and returns the result:

```
POST /v1/rooms/:roomId/judgments
```

**Request**:
```json
{ "hostText": "...", "participantText": "..." }
```

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "verdict": "host" | "participant" | "tie",
    "reasons": ["..."],
    "suggestions": ["..."],
    "quotes": [{ "from": "host", "text": "..." }]
  }
}
```

**Errors**: 400 (validation), 502 (LLM failure)

**Environment**: `OPENAI_API_KEY` (required), `OPENAI_MODEL` (default: gpt-4o), `OPENAI_BASE_URL` (optional)

## Configuration (src/constants/config.ts)

| Constant | Default | Purpose |
|----------|---------|---------|
| `APP_CONFIG.PORT` | 8080 | HTTP/WS port |
| `WS_CONFIG.PATH` | /ws | WebSocket endpoint |
| `ROOM_CONFIG.MAX_PARTICIPANTS` | 2 | Max users per room |
| `WAITING_ROOM_CONFIG.COUNTDOWN_MS` | 3000 | Waiting room countdown |
| `DRUM_CONFIG.COUNTDOWN_MS` | 3000 | Pre-game countdown |
| `DRUM_CONFIG.GAME_DURATION_MS` | 10000 | Game length |
| `OPENAI_CONFIG.API_KEY` | (env) | OpenAI API key |
| `OPENAI_CONFIG.MODEL` | gpt-4o | LLM model |
| `VERDICT_CONFIG.LLM_TIMEOUT_MS` | 30000 | LLM call timeout for verdict |
| `VERDICT_CONFIG.MAX_RETRIES` | 3 | Max verdict retry attempts |

## Enums

**`EPlayerRole`** (drum game context):
- `Organizer` - Player who created the room
- `Joiner` - Player who joined the room

## Docker

```bash
# Development (with hot reload)
docker-compose up -d

# Production
docker build -t chatroom-backend:latest -f Dockerfile .
docker run -d -p 8080:8080 -e NODE_ENV=production chatroom-backend:latest
```

## Testing API

```bash
# Health check
curl http://localhost:8080/health

# Create room
curl -X POST http://localhost:8080/v1/rooms \
  -H "Content-Type: application/json" \
  -d '{"creator":{"userId":"test_user","nickname":"Test"}}'

# LLM Judgement (synchronous — requires OPENAI_API_KEY)
curl -X POST http://localhost:8080/v1/rooms/<roomId>/judgments \
  -H "Content-Type: application/json" \
  -d '{"hostText":"我每天加班到很晚","participantText":"我工资更低"}'

# WebSocket test
npm run ws:test

# LLM E2E test
npm run test:llm
```

## Storage

Room state is managed in-memory via `room-manager.ts`. No database is required for the current MVP.

## Parent Documentation

See `../CLAUDE.md` for full project context including frontend patterns and cross-cutting concerns.
