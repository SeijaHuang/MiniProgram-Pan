# GitHub Copilot Instructions

**CRITICAL**: When generating code for this project, you MUST follow the rules defined in `.cursor/rules/` directory.

## Mandatory Reading

Before generating ANY code, read these files in order:

1. `.cursor/rules/00-general.md` - SOLID, DRY, KISS, readability principles
2. `.cursor/rules/01-typescript.md` - TypeScript strict rules
3. `.cursor/rules/02-miniprogram-frontend.md` - WXML, WXSS, animations
4. `.cursor/rules/03-miniprogram-logic.md` - Page/App lifecycle
5. `.cursor/rules/04-websocket.md` - WebSocket patterns
6. `.cursor/rules/05-architecture.md` - Project structure

## Non-Negotiable Rules

### TypeScript
- **NEVER use `any` type** - This will fail ESLint
- Always provide explicit return types
- Handle null/undefined cases explicitly
- No unused imports or variables

### WeChat Mini Program
- **Use `wx.createAnimation()` for ALL animations** - NO CSS animations
- Use `rpx` units for responsive sizing in WXSS
- Always add `wx:key` to `wx:for` loops
- Use `this.setData()` for all data updates

### Code Quality
- Follow SOLID principles
- Don't repeat code (DRY)
- Keep code simple (KISS)
- Use meaningful variable names
- Extract business logic to services
- Keep pages focused on UI logic only

### WebSocket
- Use singleton WebSocketManager pattern
- Implement heartbeat mechanism
- Include automatic reconnection
- Type all messages

## Code Style

- **Indentation**: 4 spaces
- **Quotes**: Single quotes
- **Semicolons**: Required
- **Line width**: 80 characters

## Project Structure

```
miniprogram/
├── pages/          # UI logic only
├── components/     # Reusable components
├── services/       # Business logic
├── utils/          # Pure functions
├── models/         # Type definitions
└── constants/      # Configuration
```

## Examples

### ✅ GOOD: Proper TypeScript
```typescript
async function getUser(id: string): Promise<IUser> {
    const user = await httpClient.get<IUser>(`/users/${id}`);
    return user;
}
```

### ❌ BAD: Using any
```typescript
async function getUser(id: any): any {  // FORBIDDEN
    return await fetch(`/users/${id}`);
}
```

### ✅ GOOD: Animation with wx.createAnimation
```typescript
const animation = wx.createAnimation({ duration: 300 });
animation.translateX(100).step();
this.setData({ animationData: animation.export() });
```

### ❌ BAD: CSS animation
```css
.box {
    transition: transform 0.3s;  /* FORBIDDEN */
}
```

### ✅ GOOD: Service layer
```typescript
// services/user-service.ts
class UserService {
    async login(username: string, password: string): Promise<IUser> {
        return httpClient.post('/auth/login', { username, password });
    }
}
```

### ✅ GOOD: Page uses service
```typescript
// pages/login/login.ts
import { userService } from '../../services/user-service';

Page({
    async handleLogin() {
        try {
            const user = await userService.login(username, password);
            this.setData({ user });
        } catch (error) {
            this.handleError(error);
        }
    },
});
```

## Pre-commit Checks

Every commit runs:
- ESLint (will fail on `any` types, unused variables)
- Prettier (will fail on formatting issues)

**Your code MUST pass these checks.**

## Quick Reference

| Rule | Required | Forbidden |
|------|----------|-----------|
| Types | Explicit types | `any` type |
| Animation | `wx.createAnimation()` | CSS animations |
| Styles | `rpx` units | Hardcoded `px` (except borders) |
| Lists | `wx:key` with unique ID | `wx:key="index"` or no key |
| Logic | Services layer | Logic in pages |
| Imports | Used imports only | Unused imports |
| Functions | Single responsibility | Multi-purpose functions |

## Resources

- Full rules: `.cursor/rules/`
- Project guide: `CLAUDE.md`
- README: `README.md`

---

**Remember**: These rules are enforced by automated tools. Non-compliant code will be rejected.
