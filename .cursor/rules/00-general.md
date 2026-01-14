# General Coding Principles

**CRITICAL**: These rules MUST be followed by all AI coding tools (Cursor, Claude Code, etc.) when writing code for this project.

## SOLID Principles

### Single Responsibility Principle (SRP)
- Each function should do ONE thing and do it well
- Each class/module should have ONE reason to change
- Split complex functions into smaller, focused functions
- Example:
  ```typescript
  // BAD: Function does too much
  function handleUserLogin(username: string, password: string) {
      validateInput(username, password);
      const token = authenticate(username, password);
      updateUI(token);
      logAnalytics('login', username);
      syncUserData(token);
  }

  // GOOD: Single responsibility
  function validateLoginInput(username: string, password: string): boolean { }
  function authenticateUser(username: string, password: string): string { }
  function updateLoginUI(token: string): void { }
  function logLoginEvent(username: string): void { }
  function syncUserDataAfterLogin(token: string): void { }
  ```

### Open/Closed Principle (OCP)
- Code should be open for extension, closed for modification
- Use interfaces and abstract patterns to allow new features without changing existing code
- Example:
  ```typescript
  // GOOD: Easy to extend with new animation types
  interface IAnimationStrategy {
      createAnimation(): WechatMiniprogram.Animation;
  }

  class FadeAnimation implements IAnimationStrategy {
      createAnimation() {
          return wx.createAnimation({ duration: 300 }).opacity(0).step();
      }
  }

  class SlideAnimation implements IAnimationStrategy {
      createAnimation() {
          return wx.createAnimation({ duration: 300 }).translateX(100).step();
      }
  }
  ```

### Liskov Substitution Principle (LSP)
- Derived classes must be substitutable for their base classes
- Child classes should not break parent class contracts
- Ensure consistent behavior in inheritance hierarchies

### Interface Segregation Principle (ISP)
- Don't force classes to implement interfaces they don't use
- Create small, focused interfaces rather than large monolithic ones
- Example:
  ```typescript
  // BAD: Forcing unnecessary methods
  interface IWebSocketHandler {
      onOpen(): void;
      onMessage(data: unknown): void;
      onError(error: Error): void;
      onClose(): void;
      reconnect(): void;
      sendHeartbeat(): void;
  }

  // GOOD: Segregated interfaces
  interface IWebSocketLifecycle {
      onOpen(): void;
      onClose(): void;
  }

  interface IWebSocketMessageHandler {
      onMessage(data: unknown): void;
      onError(error: Error): void;
  }

  interface IWebSocketReconnection {
      reconnect(): void;
      sendHeartbeat(): void;
  }
  ```

### Dependency Inversion Principle (DIP)
- Depend on abstractions, not concretions
- High-level modules should not depend on low-level modules
- Example:
  ```typescript
  // GOOD: Depend on interface, not implementation
  interface IStorage {
      set(key: string, value: unknown): void;
      get(key: string): unknown;
  }

  class WxStorage implements IStorage {
      set(key: string, value: unknown) {
          wx.setStorageSync(key, value);
      }
      get(key: string) {
          return wx.getStorageSync(key);
      }
  }

  class UserService {
      constructor(private storage: IStorage) {} // Depend on interface
  }
  ```

## DRY Principle (Don't Repeat Yourself)

### Eliminate Code Duplication
- If you write the same code twice, extract it into a function/class
- Use utility functions for repeated logic
- Example:
  ```typescript
  // BAD: Repeated validation logic
  function handleUsernameInput(value: string) {
      if (!value || value.length < 3 || value.length > 20) {
          wx.showToast({ title: '用户名长度错误' });
      }
  }
  function handlePasswordInput(value: string) {
      if (!value || value.length < 6 || value.length > 20) {
          wx.showToast({ title: '密码长度错误' });
      }
  }

  // GOOD: Reusable validation
  function validateLength(
      value: string,
      min: number,
      max: number,
      fieldName: string
  ): boolean {
      if (!value || value.length < min || value.length > max) {
          wx.showToast({ title: `${fieldName}长度应为${min}-${max}字符` });
          return false;
      }
      return true;
  }
  ```

### Share Common Logic
- Extract shared code into `utils/` directory
- Create reusable components for repeated UI patterns
- Use composition over duplication

### Configuration Over Hardcoding
- Extract magic numbers and strings into constants
- Use configuration objects for repeated settings
- Example:
  ```typescript
  // BAD: Hardcoded values
  wx.createAnimation({ duration: 300, timingFunction: 'ease' });
  wx.createAnimation({ duration: 300, timingFunction: 'ease' });

  // GOOD: Shared configuration
  const ANIMATION_CONFIG = {
      DURATION: 300,
      TIMING: 'ease' as const,
  };
  wx.createAnimation({
      duration: ANIMATION_CONFIG.DURATION,
      timingFunction: ANIMATION_CONFIG.TIMING
  });
  ```

## KISS Principle (Keep It Simple, Stupid)

### Simplicity Over Cleverness
- Write code that is easy to understand, not clever
- Avoid over-engineering solutions
- Simple code is easier to debug and maintain

### Avoid Premature Optimization
- Don't optimize until you have a proven performance problem
- Write clear code first, optimize later if needed
- Example:
  ```typescript
  // BAD: Over-complicated for simple task
  const result = arr.reduce((acc, curr) =>
      acc.concat(curr.items.filter(i => i.active)), []);

  // GOOD: Clear and simple
  const result: Item[] = [];
  for (const group of arr) {
      for (const item of group.items) {
          if (item.active) {
              result.push(item);
          }
      }
  }
  ```

### Minimize Nesting
- Prefer early returns over deep nesting
- Keep cyclomatic complexity low
- Example:
  ```typescript
  // BAD: Deep nesting
  function processUser(user: User | null) {
      if (user) {
          if (user.isActive) {
              if (user.hasPermission) {
                  return doSomething(user);
              }
          }
      }
      return null;
  }

  // GOOD: Early returns
  function processUser(user: User | null) {
      if (!user) return null;
      if (!user.isActive) return null;
      if (!user.hasPermission) return null;
      return doSomething(user);
  }
  ```

### Use Standard Patterns
- Prefer well-known patterns over custom solutions
- Use language/framework idioms
- Don't reinvent the wheel

## Readability Principles

### Meaningful Naming
- Use descriptive, self-documenting names
- Avoid abbreviations unless universally understood
- Example:
  ```typescript
  // BAD
  const usr = getUserData();
  const tmp = calcTotal(items);
  function hdlClk() { }

  // GOOD
  const currentUser = getUserData();
  const totalPrice = calculateTotal(items);
  function handleLoginClick() { }
  ```

### Function Length
- Keep functions short (ideally < 20 lines)
- If a function is too long, split it into smaller functions
- Each function should fit on one screen

### Comments and Documentation
- Write self-documenting code (good names > comments)
- Only add comments for "why", not "what"
- Document complex algorithms or business logic
- Example:
  ```typescript
  // BAD: Obvious comment
  // Increment counter by 1
  counter = counter + 1;

  // GOOD: Explains "why"
  // Add 1 second delay to prevent rapid repeated submissions
  setTimeout(submitForm, 1000);
  ```

### Consistent Code Style
- Follow project's Prettier and ESLint configuration
- Use 4 spaces for indentation (as configured)
- Use single quotes for strings
- Add semicolons (as enforced by Prettier)

### Type Safety
- Always provide explicit types (no `any`)
- Use TypeScript's strict mode features
- Prefer interfaces over type aliases for object shapes
- Example:
  ```typescript
  // BAD
  function getData(id: any): any {
      return wx.getStorageSync(id);
  }

  // GOOD
  function getData<T>(id: string): T | null {
      const data = wx.getStorageSync(id);
      return data as T | null;
  }
  ```

### Error Handling
- Always handle errors explicitly
- Provide meaningful error messages
- Don't silently catch and ignore errors
- Example:
  ```typescript
  // BAD
  try {
      doSomething();
  } catch (e) {
      // Silent fail
  }

  // GOOD
  try {
      doSomething();
  } catch (error) {
      console.error('Failed to perform action:', error);
      wx.showToast({
          title: '操作失败，请重试',
          icon: 'none',
      });
  }
  ```

## Code Review Checklist (For AI Tools)

Before submitting code, verify:
- [ ] Each function has a single, clear responsibility
- [ ] No code duplication (DRY)
- [ ] Code is simple and easy to understand (KISS)
- [ ] Variable and function names are descriptive
- [ ] No `any` types (strict TypeScript)
- [ ] No unused imports or variables
- [ ] Error handling is present and meaningful
- [ ] Code follows project's formatting rules
- [ ] Complex logic has explanatory comments
