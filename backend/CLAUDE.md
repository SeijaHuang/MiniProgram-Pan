# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Node.js backend for a two-player real-time chat room system. Uses HTTP for room creation and WebSocket for real-time communication including room joining, drum game, and chat messaging.

## Development Commands

```bash
npm run dev           # Start dev server (ts-node)
npm run build         # Compile TypeScript to dist/
npm start             # Run production build (dist/index.js)
npm run ws:test       # Test WebSocket connection
npm run lint          # Check code with ESLint
npm run lint:fix      # Auto-fix ESLint issues
npm run format        # Format code with Prettier
npm run format:check  # Check code formatting
npx tsc --noEmit      # Type check without emitting
```

**Server**: `http://localhost:8080`, WebSocket at `ws://localhost:8080/ws`

## Architecture

Three-layer architecture: Routes → Controllers → Services → (Repositories)

### Request Flow

**HTTP**: `routes/` → `controllers/` → `services/core/` → `services/websocket/room-manager.ts`

**WebSocket**: `ws.ts` → `controllers/ws-controller.ts` → `services/handlers/` → `services/websocket/`

### Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Entry point, creates HTTP server |
| `src/app.ts` | Express app configuration |
| `src/ws.ts` | WebSocket server initialization |
| `src/controllers/ws-controller.ts` | Routes WS messages to handlers |
| `src/services/websocket/connection-manager.ts` | Tracks WS connections |
| `src/services/websocket/room-manager.ts` | Room state management |
| `src/services/websocket/drum-game-manager.ts` | Drum game state |
| `src/constants/config.ts` | All configuration constants |

### Adding New WebSocket Message Types

1. Define types in `src/types/websocket/` (create new file or extend existing)
2. Export from `src/types/websocket/index.ts`
3. Add message type to `EWSMessageType` enum in `src/types/websocket/base.ts`
4. Create handler in `src/services/handlers/`
5. Add case to switch in `WebSocketController.handleMessage()`
6. Add Zod schema in `src/models/schemas/`

## TypeScript Conventions

- **No `any` types** - Use `unknown` with type guards
- **Interface prefix**: `I` (e.g., `IRoom`, `IUser`)
- **Enum prefix**: `E` (e.g., `ERoomStatus`, `EWSMessageType`)
- **Unused params**: Prefix with `_`
- **Explicit types** on all function parameters and return types

## Code Style

- 4 spaces indentation
- Single quotes
- Semicolons required
- 80 character line width
- Trailing comma in ES5-compatible positions

## WebSocket Message Protocol

**Client → Server**: `JOIN_ROOM`, `DRUM_TAP`, `CHAT_SEND`

**Server → Client**: `JOIN_ACK`, `DRUM_READY`, `DRUM_START`, `DRUM_TAP`, `DRUM_FINISH`, `DRUM_RESULT`, `CHAT_RECEIVE`, `ERROR`

All messages follow structure:
```typescript
interface IWSMessage<T> {
    type: EWSMessageType;
    data: T;
    timestamp: number;
}
```

## Room State Machine

```
CREATE (HTTP POST /room/create)
    ↓
WAITING (1 participant)
    ↓ (second user sends JOIN_ROOM)
READY (2 participants) → triggers drum game after 3s countdown
    ↓
CLOSED (cleanup)
```

**Constraint**: Max 2 participants per room.

## Error Codes (EWSErrorCode)

| Code | When |
|------|------|
| `ROOM_NOT_FOUND` | Room code doesn't exist |
| `ROOM_FULL` | Already 2 participants |
| `ROOM_CLOSED` | Room has been closed |
| `ALREADY_JOINED` | User already in this room |
| `NOT_PARTICIPANT` | User not a room member |
| `ROOM_NOT_READY` | Only 1 person in room |
| `INVALID_PAYLOAD` | Malformed message |
| `INTERNAL_ERROR` | Server error |

## Configuration (src/constants/config.ts)

| Constant | Default | Purpose |
|----------|---------|---------|
| `APP_CONFIG.PORT` | 8080 | HTTP/WS port |
| `WS_CONFIG.PATH` | /ws | WebSocket endpoint |
| `ROOM_CONFIG.MAX_PARTICIPANTS` | 2 | Max users per room |
| `DRUM_CONFIG.COUNTDOWN_MS` | 3000 | Pre-game countdown |
| `DRUM_CONFIG.GAME_DURATION_MS` | 10000 | Game length |

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
curl -X POST http://localhost:8080/room/create \
  -H "Content-Type: application/json" \
  -d '{"creator":{"userId":"test_user","nickname":"Test"}}'

# WebSocket test
npm run ws:test
```

## Parent Documentation

See `../CLAUDE.md` for full project context including frontend patterns and cross-cutting concerns.
