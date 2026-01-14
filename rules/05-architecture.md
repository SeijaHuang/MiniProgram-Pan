# Architecture and Project Structure Rules

**CRITICAL**: Follow these architectural patterns to maintain clean, maintainable code.

## Project Structure

### Directory Organization

```
miniprogram/
├── app.ts                  # App entry point
├── app.json                # Global config
├── app.wxss                # Global styles
├── pages/                  # Pages directory
│   ├── index/              # Each page is a directory
│   │   ├── index.ts
│   │   ├── index.wxml
│   │   ├── index.wxss
│   │   └── index.json
│   └── ...
├── components/             # Reusable components
│   ├── user-card/
│   │   ├── user-card.ts
│   │   ├── user-card.wxml
│   │   ├── user-card.wxss
│   │   └── user-card.json
│   └── ...
├── services/               # Business logic services
│   ├── user-service.ts
│   ├── game-service.ts
│   └── ...
├── utils/                  # Utility functions
│   ├── request.ts          # HTTP client
│   ├── websocket-manager.ts # WebSocket manager
│   ├── storage.ts          # Storage utilities
│   ├── animations.ts       # Animation helpers
│   └── ...
├── models/                 # Data models and interfaces
│   ├── user.ts
│   ├── game.ts
│   └── ...
├── constants/              # Constants and enums
│   ├── routes.ts
│   ├── config.ts
│   └── ...
└── assets/                 # Static assets
    ├── images/
    └── ...
```

### Module Organization Rules

- **Pages**: Only contain UI logic, delegate business logic to services
- **Components**: Self-contained, reusable UI components
- **Services**: Business logic, API calls, data processing
- **Utils**: Pure functions, no side effects
- **Models**: Type definitions, interfaces, data models
- **Constants**: Configuration, enums, magic values

## Separation of Concerns

### Page Layer (Presentation)

- Handle user interactions
- Manage UI state
- Delegate business logic to services
- Example:

    ```typescript
    // pages/game/game.ts - GOOD
    import { gameService } from '../../services/game-service';
    import { wsManager } from '../../utils/websocket-manager';

    Page({
        data: {
            gameState: null,
            isLoading: false,
        },

        async onLoad(options: Record<string, string | undefined>) {
            await this.initGame(options.gameId);
        },

        async initGame(gameId: string | undefined) {
            this.setData({ isLoading: true });

            try {
                // Delegate to service layer
                const gameState = await gameService.joinGame(gameId);
                this.setData({ gameState, isLoading: false });
            } catch (error) {
                this.handleError(error);
            }
        },

        handleMove(event: WechatMiniprogram.TouchEvent) {
            const { x, y } = event.currentTarget.dataset;
            gameService.makeMove(x as number, y as number);
        },

        handleError(error: unknown) {
            this.setData({ isLoading: false });
            wx.showToast({
                title: '操作失败',
                icon: 'none',
            });
        },
    });
    ```

### Service Layer (Business Logic)

- Implement business rules
- Handle API communication
- Process and transform data
- Example:

    ```typescript
    // services/game-service.ts - GOOD
    import { httpClient } from '../utils/request';
    import { wsManager } from '../utils/websocket-manager';

    interface IGameState {
        id: string;
        players: IPlayer[];
        currentTurn: string;
    }

    interface IPlayer {
        id: string;
        name: string;
    }

    class GameService {
        private currentGame: IGameState | null = null;

        async joinGame(gameId?: string): Promise<IGameState> {
            // Business logic: Join existing game or create new one
            if (gameId) {
                return this.joinExistingGame(gameId);
            } else {
                return this.createNewGame();
            }
        }

        private async joinExistingGame(gameId: string): Promise<IGameState> {
            const game = await httpClient.post<IGameState>('/games/join', {
                gameId,
            });
            this.currentGame = game;
            this.setupWebSocket(gameId);
            return game;
        }

        private async createNewGame(): Promise<IGameState> {
            const game = await httpClient.post<IGameState>('/games/create', {});
            this.currentGame = game;
            this.setupWebSocket(game.id);
            return game;
        }

        makeMove(x: number, y: number): void {
            if (!this.currentGame) {
                throw new Error('No active game');
            }

            // Business logic: Validate move
            if (!this.isValidMove(x, y)) {
                throw new Error('Invalid move');
            }

            // Send move via WebSocket
            wsManager.send('game:move', { x, y });
        }

        private isValidMove(x: number, y: number): boolean {
            // Move validation logic
            return x >= 0 && x < 10 && y >= 0 && y < 10;
        }

        private setupWebSocket(gameId: string): void {
            wsManager.on('game:update', message => {
                this.currentGame = message.data as IGameState;
            });
        }
    }

    export const gameService = new GameService();
    ```

### Utility Layer (Pure Functions)

- Stateless helper functions
- No side effects
- Easily testable
- Example:

    ```typescript
    // utils/formatters.ts - GOOD
    export class DateFormatter {
        static formatDate(date: Date): string {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        static formatTime(date: Date): string {
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${hours}:${minutes}`;
        }

        static formatDateTime(date: Date): string {
            return `${this.formatDate(date)} ${this.formatTime(date)}`;
        }
    }

    export class StringValidator {
        static isValidEmail(email: string): boolean {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(email);
        }

        static isValidPhone(phone: string): boolean {
            const phoneRegex = /^1[3-9]\d{9}$/;
            return phoneRegex.test(phone);
        }
    }
    ```

## Dependency Management

### Dependency Injection Pattern

- Inject dependencies instead of creating them
- Makes code testable and maintainable
- Example:

    ```typescript
    // BAD: Hard-coded dependencies
    class UserService {
        private storage = new StorageService();
        private http = new HttpClient();

        async getUser(id: string) {
            return this.http.get(`/users/${id}`);
        }
    }

    // GOOD: Dependency injection
    interface IStorage {
        get<T>(key: string): T | null;
        set(key: string, value: unknown): void;
    }

    interface IHttpClient {
        get<T>(url: string): Promise<T>;
    }

    class UserService {
        constructor(
            private storage: IStorage,
            private http: IHttpClient
        ) {}

        async getUser(id: string): Promise<IUser> {
            return this.http.get<IUser>(`/users/${id}`);
        }
    }

    // Usage
    const userService = new UserService(storageService, httpClient);
    ```

### Factory Pattern for Complex Objects

- Use factories to create complex objects
- Example:

    ```typescript
    // models/game.ts
    interface IGameConfig {
        boardSize: number;
        playerCount: number;
        timeLimit: number;
    }

    interface IGame {
        id: string;
        config: IGameConfig;
        players: IPlayer[];
        createdAt: Date;
    }

    class GameFactory {
        static createGame(config: Partial<IGameConfig>): IGame {
            const defaultConfig: IGameConfig = {
                boardSize: 10,
                playerCount: 2,
                timeLimit: 600,
            };

            return {
                id: this.generateId(),
                config: { ...defaultConfig, ...config },
                players: [],
                createdAt: new Date(),
            };
        }

        private static generateId(): string {
            return `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
    }
    ```

## State Management

### Page-level State

- Keep state local to pages when possible
- Use `setData()` for reactive updates
- Example:

    ```typescript
    Page({
        data: {
            user: null as IUser | null,
            isLoading: false,
            error: null as string | null,
        },

        updateUser(user: IUser) {
            this.setData({ user });
        },
    });
    ```

### App-level State (Global)

- Use `globalData` for truly global state
- Keep global state minimal
- Example:

    ```typescript
    // app.ts
    interface IGlobalData {
        userInfo: WechatMiniprogram.UserInfo | null;
        token: string | null;
        theme: 'light' | 'dark';
    }

    App<IAppOption>({
        globalData: {
            userInfo: null,
            token: null,
            theme: 'light',
        } as IGlobalData,
    });
    ```

### Shared State via Services

- Use services to share state between pages
- Implement observer pattern for reactive updates
- Example:

    ```typescript
    // services/auth-service.ts
    type AuthStateChangeHandler = (isAuthenticated: boolean) => void;

    class AuthService {
        private isAuthenticated = false;
        private handlers: AuthStateChangeHandler[] = [];

        login(username: string, password: string): void {
            // Login logic
            this.isAuthenticated = true;
            this.notifyHandlers();
        }

        logout(): void {
            this.isAuthenticated = false;
            this.notifyHandlers();
        }

        getAuthState(): boolean {
            return this.isAuthenticated;
        }

        onAuthStateChange(handler: AuthStateChangeHandler): void {
            this.handlers.push(handler);
        }

        private notifyHandlers(): void {
            this.handlers.forEach(handler => handler(this.isAuthenticated));
        }
    }

    export const authService = new AuthService();
    ```

## Code Reusability

### Extract Common Logic to Utils

- Don't repeat code across pages
- Example:

    ```typescript
    // utils/ui-helpers.ts
    export class UIHelper {
        static showLoading(title: string = '加载中...'): void {
            wx.showLoading({ title, mask: true });
        }

        static hideLoading(): void {
            wx.hideLoading();
        }

        static showSuccess(title: string): void {
            wx.showToast({ title, icon: 'success' });
        }

        static showError(title: string): void {
            wx.showToast({ title, icon: 'none' });
        }

        static async confirm(title: string, content: string): Promise<boolean> {
            return new Promise(resolve => {
                wx.showModal({
                    title,
                    content,
                    success: res => resolve(res.confirm),
                });
            });
        }
    }
    ```

### Create Reusable Components

- Extract repeated UI patterns into components
- Example:
    ```typescript
    // components/loading-spinner/loading-spinner.ts
    Component({
        properties: {
            size: {
                type: String,
                value: 'medium', // 'small' | 'medium' | 'large'
            },
            color: {
                type: String,
                value: '#07c160',
            },
        },
    });
    ```

### Composition over Inheritance

- Prefer composition to class inheritance
- Example:

    ```typescript
    // GOOD: Composition
    class UserProfile {
        constructor(
            private storage: IStorage,
            private validator: IValidator,
            private formatter: IFormatter
        ) {}

        saveProfile(data: IUserData): void {
            if (!this.validator.validate(data)) {
                throw new Error('Invalid data');
            }
            const formatted = this.formatter.format(data);
            this.storage.save('profile', formatted);
        }
    }
    ```

## Constants and Configuration

### Extract Magic Values to Constants

- Don't hardcode values
- Example:

    ```typescript
    // constants/config.ts
    export const API_CONFIG = {
        BASE_URL: 'https://api.example.com',
        TIMEOUT: 10000,
        RETRY_ATTEMPTS: 3,
    } as const;

    export const WEBSOCKET_CONFIG = {
        URL: 'wss://ws.example.com',
        HEARTBEAT_INTERVAL: 30000,
        RECONNECT_INTERVAL: 3000,
        MAX_RECONNECT_ATTEMPTS: 5,
    } as const;

    export const ROUTES = {
        HOME: '/pages/index/index',
        GAME: '/pages/game/game',
        PROFILE: '/pages/profile/profile',
    } as const;

    export const ANIMATION_DURATION = {
        FAST: 150,
        NORMAL: 300,
        SLOW: 600,
    } as const;
    ```

## Error Handling Architecture

### Centralized Error Handler

- Create error handling service
- Example:

    ```typescript
    // services/error-handler.ts
    class ErrorHandler {
        handle(error: unknown, context?: string): void {
            console.error('Error occurred:', error, 'Context:', context);

            const errorMessage = this.getErrorMessage(error);
            this.showErrorToUser(errorMessage);
            this.reportError(error, context);
        }

        private getErrorMessage(error: unknown): string {
            if (error instanceof Error) {
                return error.message;
            }
            return '发生未知错误';
        }

        private showErrorToUser(message: string): void {
            wx.showToast({
                title: message,
                icon: 'none',
                duration: 3000,
            });
        }

        private reportError(error: unknown, context?: string): void {
            // Send error to monitoring service
            wx.request({
                url: 'https://api.example.com/errors',
                method: 'POST',
                data: {
                    error: String(error),
                    context,
                    timestamp: Date.now(),
                },
            });
        }
    }

    export const errorHandler = new ErrorHandler();
    ```

## Architecture Checklist (For AI Tools)

Before writing code, ensure:

- [ ] Pages only contain UI logic
- [ ] Business logic is in services
- [ ] Utility functions are pure (no side effects)
- [ ] Dependencies are injected, not hard-coded
- [ ] Common logic is extracted to utils
- [ ] Magic values are in constants
- [ ] State management is appropriate for scope
- [ ] Components are reusable and self-contained
- [ ] Error handling is centralized
- [ ] Code follows single responsibility principle
