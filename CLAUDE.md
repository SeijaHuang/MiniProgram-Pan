# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Two-player real-time interactive WeChat Mini Program ("申冤" app) with a Node.js backend. Users create/join rooms, compete in a drum-tapping game to decide speaking order, then take turns voicing grievances.

**User Flow**: Welcome → Waiting Room → Drum Room (5s tap competition) → Chat Room (turn-based voice chat)

**Tech Stack**:

- **Frontend**: WeChat Mini Program native framework (TypeScript, WXML, WXSS)
- **Backend**: Node.js + Express + WebSocket (ws library)

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
npm run dev            # Start dev server (ts-node, hot reload)
npm run build          # Compile TypeScript to dist/
npm start              # Run production build
npm run ws:test        # Test WebSocket connection
npm run lint           # Check code with ESLint
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
├── pages/              # welcome/, waiting-room/, drum/, chat-room/
├── components/         # styled-button/, styled-title/
├── services/           # Business logic, API calls
├── models/             # Domain interfaces (IUser, IRoom, IMessage)
├── types/              # API/WebSocket contract types
├── constants/          # Centralized config
└── utils/              # Pure utility functions
```

### Backend Structure (backend/src/)

```
backend/src/
├── routes/             # HTTP route definitions
├── controllers/        # Request/response handling
├── services/           # Business logic (core/, websocket/, handlers/)
├── models/             # entities/, dto/, interfaces/, enums/
├── repositories/       # Data access layer (future DB support)
├── middlewares/        # validation/, error/, logging/
├── types/              # TypeScript type definitions
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
- **Object parameters for 3+ arguments** - Functions with 3 or more parameters must use a single options object instead of positional arguments for readability

```typescript
// ✅ Correct
const count: number = 0;
const name: string = 'user';
const items: string[] = [];

function add(a: number, b: number): number {
    return a + b;
}

const multiply = (x: number, y: number): number => x * y;

// ❌ Wrong - missing type annotations
const count = 0;
const name = 'user';
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

### WXSS

- Use `rpx` for responsive sizing (750rpx = screen width)
- Use BEM naming: `.block__element--modifier`
- Global styles in `app.wxss`, page-specific in page `.wxss`
- **No `!important`** - Fix specificity issues properly instead of using `!important`

## WebSocket Pattern

### Frontend (singleton WebSocketManager)

- Heartbeat mechanism to keep connection alive
- Automatic reconnection with max attempts
- Register handlers in `onLoad`, unregister in `onUnload`
- Use WSS (secure WebSocket) protocol

### Backend Message Protocol

- **Client → Server**: `JOIN_ROOM`, `CHAT_SEND`
- **Server → Client**: `JOIN_ACK`, `CHAT_RECEIVE`, `ERROR`
- Room states: `WAITING` (1 person) → `READY` (2 people) → `CLOSED`

### Room Flow

1. Creator calls `POST /room/create` → gets `roomCode`
2. Both users connect via WebSocket, send `JOIN_ROOM` with `roomCode`
3. When 2 users join, room becomes `READY`, chat enabled

## Type Definitions

- **Frontend custom types**: `typings/` directory
- **WeChat API types**: `miniprogram-api-typings` package, use `WechatMiniprogram` namespace
- **Backend types**: `backend/src/types/` (http.ts, ws-messages.ts, common.ts)
