# TypeScript Rules

**CRITICAL**: All TypeScript code must follow these strict rules.

## Type Safety (MANDATORY)

### No `any` Type - EVER

- Using `any` is **FORBIDDEN** and will fail ESLint checks
- Use `unknown` for truly dynamic types, then narrow with type guards
- Example:

    ```typescript
    // BAD: Using any
    function processData(data: any) {
        return data.value;
    }

    // GOOD: Use unknown with type guards
    function processData(data: unknown): string {
        if (typeof data === 'object' && data !== null && 'value' in data) {
            return String(data.value);
        }
        throw new Error('Invalid data format');
    }
    ```

### Explicit Return Types

- Always specify return types for functions
- Don't rely on type inference for function returns
- Example:

    ```typescript
    // BAD
    function calculateTotal(items) {
        return items.reduce((sum, item) => sum + item.price, 0);
    }

    // GOOD
    function calculateTotal(items: CartItem[]): number {
        return items.reduce((sum, item) => sum + item.price, 0);
    }
    ```

### Strict Null Checks

- Project has `strictNullChecks: true` enabled
- Always handle null/undefined cases explicitly
- Use optional chaining `?.` and nullish coalescing `??`
- Example:

    ```typescript
    // BAD
    function getUserName(user: User | null) {
        return user.name; // Error: user might be null
    }

    // GOOD
    function getUserName(user: User | null): string {
        return user?.name ?? 'Guest';
    }
    ```

### No Implicit Any

- Project has `noImplicitAny: true` enabled
- All parameters and variables must have explicit types
- Example:

    ```typescript
    // BAD
    function process(data) {
        // Error: implicit any
        return data;
    }

    // GOOD
    function process(data: UserData): ProcessedData {
        return transformData(data);
    }
    ```

## Interface and Type Definitions

### Prefer Interfaces for Objects

- Use `interface` for object shapes
- Use `type` for unions, primitives, tuples
- Example:

    ```typescript
    // GOOD: Interface for object shape
    interface User {
        id: string;
        name: string;
        email: string;
    }

    // GOOD: Type for union
    type UserRole = 'admin' | 'user' | 'guest';

    // GOOD: Type for complex union
    type ApiResponse = SuccessResponse | ErrorResponse;
    ```

### Naming Conventions

- Interfaces: PascalCase, prefix with `I` (e.g., `IUser`, `IWebSocketHandler`)
- Types: PascalCase (e.g., `UserRole`, `ApiResponse`)
- Enums: PascalCase for name, UPPER_CASE for values
- Example:

    ```typescript
    interface IUserService {
        getUser(id: string): Promise<IUser>;
    }

    type LoadingState = 'idle' | 'loading' | 'success' | 'error';

    enum ConnectionStatus {
        CONNECTED = 'CONNECTED',
        DISCONNECTED = 'DISCONNECTED',
        CONNECTING = 'CONNECTING',
    }
    ```

### WeChat Mini Program Types

- Use `WechatMiniprogram` namespace for WeChat types
- Import from `miniprogram-api-typings` package
- Example:

    ```typescript
    // Page data type
    interface IPageData {
        userInfo: WechatMiniprogram.UserInfo;
        hasUserInfo: boolean;
    }

    // Component properties
    interface IComponentProps {
        title: string;
        onTap: WechatMiniprogram.EventCallback;
    }

    // WebSocket task
    private socketTask: WechatMiniprogram.SocketTask | null = null;
    ```

## Type Guards and Narrowing

### Use Type Guards for Runtime Checking

- Create custom type guards for complex types
- Use `is` keyword for type predicate functions
- Example:

    ```typescript
    interface ISuccessResponse {
        success: true;
        data: unknown;
    }

    interface IErrorResponse {
        success: false;
        error: string;
    }

    type ApiResponse = ISuccessResponse | IErrorResponse;

    // Type guard
    function isSuccessResponse(
        response: ApiResponse
    ): response is ISuccessResponse {
        return response.success === true;
    }

    // Usage
    function handleResponse(response: ApiResponse): void {
        if (isSuccessResponse(response)) {
            console.log(response.data); // Type narrowed to ISuccessResponse
        } else {
            console.error(response.error); // Type narrowed to IErrorResponse
        }
    }
    ```

### Narrowing with typeof and instanceof

- Use `typeof` for primitives
- Use `instanceof` for classes
- Example:
    ```typescript
    function processValue(value: string | number): string {
        if (typeof value === 'string') {
            return value.toUpperCase();
        }
        return value.toFixed(2);
    }
    ```

## Generic Types

### Use Generics for Reusability

- Create generic functions/classes for type-safe reusable code
- Constrain generics with `extends` when needed
- Example:

    ```typescript
    // Generic storage wrapper
    class Storage<T> {
        private key: string;

        constructor(key: string) {
            this.key = key;
        }

        save(data: T): void {
            wx.setStorageSync(this.key, JSON.stringify(data));
        }

        load(): T | null {
            const data = wx.getStorageSync(this.key);
            return data ? (JSON.parse(data) as T) : null;
        }
    }

    // Usage
    interface IUserProfile {
        id: string;
        name: string;
    }

    const userStorage = new Storage<IUserProfile>('user_profile');
    userStorage.save({ id: '123', name: 'John' });
    const user = userStorage.load(); // Type: IUserProfile | null
    ```

### Constrain Generics

- Use `extends` to constrain generic types
- Example:

    ```typescript
    interface IIdentifiable {
        id: string;
    }

    function findById<T extends IIdentifiable>(
        items: T[],
        id: string
    ): T | undefined {
        return items.find(item => item.id === id);
    }
    ```

## Unused Variables and Imports

### No Unused Code

- Project has `noUnusedLocals: true` and `noUnusedParameters: true`
- Remove all unused imports and variables
- Use `_` prefix for intentionally unused parameters
- Example:

    ```typescript
    // BAD
    import { formatTime } from './utils/util'; // Unused import
    function process(data: string, _config: Config) {
        // _config not used
        return data;
    }

    // GOOD
    function process(data: string, _config: Config): string {
        // _config has underscore prefix, indicating intentional non-use
        return data;
    }

    // ESLint config allows:
    // - argsIgnorePattern: "^_"
    // - varsIgnorePattern: "^_"
    ```

## Async/Promise Handling

### Proper Promise Types

- Always type Promise return values
- Handle Promise rejections
- Example:

    ```typescript
    // BAD
    async function fetchUserData(id: string) {
        const response = await fetch(`/api/users/${id}`);
        return response.json();
    }

    // GOOD
    async function fetchUserData(id: string): Promise<IUser> {
        try {
            const response = await fetch(`/api/users/${id}`);
            const data = await response.json();
            return data as IUser;
        } catch (error) {
            console.error('Failed to fetch user:', error);
            throw new Error('Unable to load user data');
        }
    }
    ```

### WeChat API Promisify

- WeChat APIs use callbacks, consider creating Promise wrappers
- Example:

    ```typescript
    function wxRequest<T>(
        options: WechatMiniprogram.RequestOption
    ): Promise<T> {
        return new Promise((resolve, reject) => {
            wx.request({
                ...options,
                success: res => {
                    resolve(res.data as T);
                },
                fail: error => {
                    reject(error);
                },
            });
        });
    }

    // Usage
    interface IApiUser {
        id: string;
        name: string;
    }

    async function getUser(id: string): Promise<IApiUser> {
        return wxRequest<IApiUser>({
            url: `/api/users/${id}`,
            method: 'GET',
        });
    }
    ```

## Const Assertions and Readonly

### Use `const` Assertions

- Use `as const` for literal types
- Makes objects/arrays readonly and narrows types
- Example:

    ```typescript
    // GOOD: Const assertion
    const ROUTES = {
        HOME: '/pages/index/index',
        LOGS: '/pages/logs/logs',
    } as const;

    type RouteKey = keyof typeof ROUTES; // 'HOME' | 'LOGS'

    // GOOD: Array const assertion
    const ALLOWED_ROLES = ['admin', 'user', 'guest'] as const;
    type Role = (typeof ALLOWED_ROLES)[number]; // 'admin' | 'user' | 'guest'
    ```

### Readonly Properties

- Use `readonly` for immutable properties
- Example:

    ```typescript
    interface IConfig {
        readonly apiUrl: string;
        readonly timeout: number;
    }

    class ApiService {
        private readonly baseUrl: string;

        constructor(baseUrl: string) {
            this.baseUrl = baseUrl;
        }
    }
    ```

## Type Safety Checklist (For AI Tools)

Before writing TypeScript code, ensure:

- [ ] No `any` types are used
- [ ] All function parameters have explicit types
- [ ] All function return types are explicit
- [ ] Null/undefined cases are handled
- [ ] No unused imports or variables
- [ ] Interfaces use `I` prefix
- [ ] WeChat types use `WechatMiniprogram` namespace
- [ ] Generics are used for reusable code
- [ ] Type guards are used for runtime checks
- [ ] Async functions return typed Promises
