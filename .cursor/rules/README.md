# Coding Rules for AI Tools

This directory contains **mandatory coding rules** that MUST be followed by all AI coding assistants (Cursor, Claude Code, GitHub Copilot, etc.) when working on this project.

## Purpose

These rules ensure:
- **Code Quality**: SOLID, DRY, KISS principles
- **Type Safety**: Strict TypeScript without `any` types
- **Consistency**: Uniform code style across the project
- **Maintainability**: Clean architecture and separation of concerns
- **Framework Compliance**: Proper WeChat Mini Program patterns

## Rule Files

The rules are organized into numbered files that should be read in order:

### 00-general.md
**General Coding Principles**
- SOLID principles (Single Responsibility, Open/Closed, etc.)
- DRY (Don't Repeat Yourself)
- KISS (Keep It Simple, Stupid)
- Readability and code style guidelines

### 01-typescript.md
**TypeScript Rules**
- **CRITICAL**: NO `any` types allowed (ESLint will fail)
- Explicit return types required
- Strict null checks
- Type guards and narrowing
- Generic types usage

### 02-miniprogram-frontend.md
**WeChat Mini Program Frontend Rules**
- WXML template best practices
- WXSS styling with `rpx` units
- **CRITICAL**: Animations MUST use `wx.createAnimation()` (NO CSS animations)
- Component patterns
- Performance optimization

### 03-miniprogram-logic.md
**WeChat Mini Program Logic Layer Rules**
- App and Page lifecycle management
- Data binding with `setData()`
- Event handlers
- Page navigation
- Storage management
- API request handling

### 04-websocket.md
**WebSocket Real-time Communication Rules**
- WebSocket manager singleton pattern
- Connection management with heartbeat
- Automatic reconnection
- Message protocol and typing
- Error handling

### 05-architecture.md
**Architecture and Project Structure Rules**
- Directory organization
- Separation of concerns (Pages/Services/Utils)
- Dependency injection
- State management
- Code reusability patterns

## How AI Tools Should Use These Rules

### For Cursor
Cursor automatically reads files in `.cursor/rules/` directory. These rules will be applied to all code suggestions.

### For Claude Code
Claude Code reads `CLAUDE.md` which references these rules. AI must read and apply these rules before writing code.

### For GitHub Copilot
Copy these rules to `.github/copilot-instructions.md` for Copilot to follow.

## Enforcement

These rules are enforced through:

1. **Pre-commit Hooks**: Husky + lint-staged
   - ESLint checks TypeScript rules
   - Prettier enforces code formatting
   - Commits will be BLOCKED if rules are violated

2. **Code Review**: All PRs must comply with these rules

3. **AI Awareness**: AI coding tools must read and follow these rules

## Rule Checklist (For AI Tools)

Before submitting code, verify:

- [ ] Followed SOLID principles (single responsibility, etc.)
- [ ] No code duplication (DRY)
- [ ] Code is simple and readable (KISS)
- [ ] NO `any` types used
- [ ] All functions have explicit return types
- [ ] Proper error handling
- [ ] WXML uses `wx:key` for lists
- [ ] Animations use `wx.createAnimation()` ONLY
- [ ] Business logic is in services, not pages
- [ ] WebSocket uses singleton manager pattern
- [ ] Proper separation of concerns

## Examples

Each rule file contains extensive examples showing:
- ✅ GOOD: Correct implementation
- ❌ BAD: What to avoid

**Always refer to the rule files when unsure about implementation patterns.**

## Updates

When updating these rules:
1. Discuss with the team
2. Update the relevant rule file
3. Update this README if structure changes
4. Commit with clear message explaining the change

## Questions?

If any rule is unclear or seems contradictory, please:
1. Check the examples in the rule file
2. Discuss with the team
3. Propose clarifications via PR

---

**Remember**: These rules exist to maintain code quality and consistency. They are not optional.
