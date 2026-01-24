# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WeChat Mini Program built with the **native framework** (not React/Vue/uni-app) using TypeScript. Supports real-time two-player interactive features via WebSocket.

## Development Commands

```bash
npm install            # Install dependencies
npm run prepare        # Initialize Husky git hooks

npm run lint           # Check code with ESLint
npm run lint:fix       # Auto-fix ESLint issues
npm run format         # Format code with Prettier
npm run format:check   # Check Prettier formatting
```

## Development Environment

- **Tool**: WeChat DevTools (微信开发者工具) - required to run/preview
- **Node.js**: >= 14.0.0
- **Entry Point**: `miniprogram/` directory

## Architecture

### Directory Structure

```
miniprogram/
├── app.ts              # App entry with App<IAppOption>()
├── app.json            # Global config, page routes
├── app.wxss            # Global styles
├── pages/              # Each page = directory with .ts/.wxml/.wxss/.json
├── components/         # Reusable components (same 4-file structure)
├── services/           # Business logic, API calls
├── models/             # Domain object interfaces (IUser, IRoom, IMessage)
├── types/              # API/WebSocket contract types
├── constants/          # Centralized configuration (config.ts)
├── utils/              # Pure utility functions
└── assets/             # Static assets (images, etc.)
```

### Separation of Concerns

- **Pages**: UI logic only - delegate business logic to services
- **Services**: Business rules, API communication, data processing
- **Utils**: Pure functions, no side effects, easily testable

### Key Patterns

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

For real-time two-player features, implement singleton WebSocketManager:

```typescript
class WebSocketManager {
    private static instance: WebSocketManager;
    private socketTask: WechatMiniprogram.SocketTask | null = null;

    static getInstance(): WebSocketManager {
        /* ... */
    }
    connect(url: string): Promise<void> {
        /* ... */
    }
    send(type: string, data: unknown): void {
        /* ... */
    }
    on(messageType: string, handler: MessageHandler): void {
        /* ... */
    }
}
```

Key requirements:

- Heartbeat mechanism to keep connection alive
- Automatic reconnection with max attempts
- Register handlers in `onLoad`, unregister in `onUnload`
- Use WSS (secure WebSocket) protocol

## Type Definitions

- **Custom types**: `typings/` directory
- **WeChat API types**: `miniprogram-api-typings` package
- **Namespace**: `WechatMiniprogram` for all WeChat types
