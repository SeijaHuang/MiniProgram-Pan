# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ MANDATORY CODING RULES ⚠️

**CRITICAL**: Before writing ANY code, you MUST read and follow the rules in `.cursor/rules/` directory. These rules are MANDATORY for all AI coding tools (Cursor, Claude Code, etc.).

### Rule Files (Read in Order):

1. **`.cursor/rules/00-general.md`** - SOLID, DRY, KISS, readability principles
2. **`.cursor/rules/01-typescript.md`** - TypeScript strict rules (NO `any` types)
3. **`.cursor/rules/02-miniprogram-frontend.md`** - WXML, WXSS, animations, components
4. **`.cursor/rules/03-miniprogram-logic.md`** - Page/App lifecycle, data management
5. **`.cursor/rules/04-websocket.md`** - WebSocket implementation patterns
6. **`.cursor/rules/05-architecture.md`** - Project structure, separation of concerns

**These rules are NON-NEGOTIABLE**. Every code change must comply with these standards. Failure to follow these rules will result in code that fails linting, breaks the build, or violates project architecture.

## Project Overview

This is a WeChat Mini Program built with the **native WeChat Mini Program framework** (not React/Vue/uni-app) using TypeScript. The project supports real-time two-player interactive features via WebSocket.

## Development Commands

```bash
# Install dependencies
npm install

# Initialize Husky git hooks
npm run prepare

# Linting and formatting
npm run lint              # Check code with ESLint
npm run lint:fix          # Auto-fix ESLint issues
npm run format            # Format code with Prettier
npm run format:check      # Check Prettier formatting
```

## Development Environment

- **Tool**: WeChat DevTools (微信开发者工具) is required to run and preview the Mini Program
- **Node.js**: >= 14.0.0
- **Entry Point**: `miniprogram/` directory (configured in `project.config.json`)
- **AppID**: `wxb5671c7f8f976e0d` (in `project.config.json`)

## Architecture

### File Structure

```
miniprogram/
├── app.ts              # Application entry (App lifecycle)
├── app.json            # Global configuration (pages, window, theme)
├── app.wxss            # Global styles
├── pages/              # Page directories
│   ├── index/          # Each page has: .ts, .wxml, .wxss, .json
│   └── logs/
├── components/         # Custom components (future)
└── utils/              # Utility functions
```

### WeChat Mini Program Structure

Each page consists of 4 files:
- `.ts` - TypeScript logic (Page lifecycle, data, event handlers)
- `.wxml` - Template markup (similar to HTML)
- `.wxss` - Styles (similar to CSS)
- `.json` - Page configuration

### Key Framework Concepts

- **App**: Defined in `app.ts` with `App<IAppOption>()`, contains global data and lifecycle hooks
- **Page**: Each page uses `Page()` constructor with lifecycle methods (onLoad, onShow, etc.)
- **Data Binding**: Use `this.setData()` to update view (one-way data binding)
- **Navigation**: Configured in `app.json` pages array; use `wx.navigateTo()`, `wx.redirectTo()` for routing

### Animation Implementation

All animations MUST use `wx.createAnimation()` API, NOT CSS animations:

```typescript
const animation = wx.createAnimation({
    duration: 1000,
    timingFunction: 'ease',
});
animation.translateX(100).step();
this.setData({ animationData: animation.export() });
```

### WebSocket for Real-time Communication

Project requires WebSocket for two-player real-time features. Suggested pattern:

```typescript
// utils/websocket.ts
class WebSocketManager {
    private socketTask: WechatMiniprogram.SocketTask | null = null;

    connect(url: string) {
        this.socketTask = wx.connectSocket({ url });
        this.socketTask.onMessage((res) => {
            // Handle messages
        });
    }
}
```

## Code Standards

### TypeScript Configuration

- **Strict mode enabled**: All strict TypeScript checks are active
- **No implicit any**: Must provide explicit types
- **No unused variables/imports**: Will fail pre-commit if present
- **ESLint enforces**: `@typescript-eslint/no-explicit-any: "error"`

### Code Style (Enforced by Prettier)

- **Indentation**: 4 spaces (not tabs)
- **Quotes**: Single quotes
- **Semicolons**: Required
- **Line width**: 80 characters
- **Trailing commas**: ES5 style

### Pre-commit Hooks

Husky + lint-staged runs automatically on `git commit`:
- ESLint checks and auto-fixes `.ts` and `.js` files
- Prettier formats `.ts`, `.js`, `.json`, `.md` files
- Commit will be blocked if unfixable errors exist

### Framework Constraints

- **Native API only**: Do NOT use React, Vue, uni-app, or other frameworks
- **TypeScript for logic**: All `.ts` files must have proper types
- **WXML for templates**: Use WeChat's template syntax
- **WXSS for styles**: Use WeChat's styling system
- **wx.createAnimation for animations**: Do NOT use CSS transitions/animations

## Type Definitions

- **Location**: `typings/` directory (custom WeChat API types)
- **Package**: `miniprogram-api-typings` provides official WeChat API types
- **Usage**: TypeScript will automatically reference types from `typeRoots`

## Configuration Files

- `.eslintrc.json`: ESLint with TypeScript rules, Prettier integration
- `.prettierrc.json`: Code formatting rules
- `tsconfig.json`: TypeScript strict mode with ES2020 target
- `project.config.json`: WeChat DevTools project settings
- `app.json`: Mini Program global config (pages, navigation bar, theme)
