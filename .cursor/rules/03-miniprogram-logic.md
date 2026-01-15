# WeChat Mini Program Logic Layer Rules

**CRITICAL**: Logic layer code must follow WeChat Mini Program lifecycle and data flow patterns.

## App Instance Rules

### App Lifecycle

- Use `App()` constructor in `app.ts`
- Define global data in `globalData`
- Implement lifecycle hooks properly
- Example:

    ```typescript
    // app.ts
    interface IGlobalData {
        userInfo: WechatMiniprogram.UserInfo | null;
        token: string | null;
    }

    App<IAppOption>({
        globalData: {
            userInfo: null,
            token: null,
        } as IGlobalData,

        onLaunch(options: WechatMiniprogram.App.LaunchShowOption) {
            console.log('App launched with options:', options);
            this.initApp();
        },

        onShow(options: WechatMiniprogram.App.LaunchShowOption) {
            console.log('App shown');
        },

        onHide() {
            console.log('App hidden');
        },

        onError(error: string) {
            console.error('App error:', error);
            this.reportError(error);
        },

        initApp() {
            // App initialization logic
            this.loadUserInfo();
        },

        loadUserInfo() {
            const userInfo = wx.getStorageSync('userInfo');
            if (userInfo) {
                this.globalData.userInfo = userInfo;
            }
        },

        reportError(error: string) {
            // Error reporting logic
        },
    });
    ```

### Access App Instance

- Use `getApp()` to access app instance from pages
- Always type the app instance
- Example:
    ```typescript
    // In page
    const app = getApp<IAppOption>();
    const userInfo = app.globalData.userInfo;
    ```

## Page Instance Rules

### Page Lifecycle

- Use `Page()` constructor for page definitions
- Implement lifecycle hooks in correct order
- Example:

    ```typescript
    interface IPageData {
        title: string;
        items: IItem[];
        isLoading: boolean;
    }

    Page({
        data: {
            title: '',
            items: [],
            isLoading: false,
        } as IPageData,

        // Lifecycle: Page first load
        onLoad(options: Record<string, string | undefined>) {
            console.log('Page loaded with options:', options);
            const { id } = options;
            if (id) {
                this.loadData(id);
            }
        },

        // Lifecycle: Page shown
        onShow() {
            console.log('Page shown');
            this.refreshData();
        },

        // Lifecycle: Page ready
        onReady() {
            console.log('Page rendered');
        },

        // Lifecycle: Page hidden
        onHide() {
            console.log('Page hidden');
        },

        // Lifecycle: Page unloaded
        onUnload() {
            console.log('Page unloaded');
            this.cleanup();
        },

        // Custom methods
        loadData(id: string) {
            this.setData({ isLoading: true });
            // Load data logic
        },

        refreshData() {
            // Refresh data logic
        },

        cleanup() {
            // Cleanup logic (e.g., clear timers, close connections)
        },
    });
    ```

### Page Data Management

- Define data interface for type safety
- Use `setData()` for all data updates
- Batch updates when possible
- Example:

    ```typescript
    interface IUserPageData {
        user: IUser | null;
        posts: IPost[];
        totalCount: number;
        isLoading: boolean;
    }

    Page({
        data: {
            user: null,
            posts: [],
            totalCount: 0,
            isLoading: false,
        } as IUserPageData,

        // BAD: Multiple setData calls
        updateUserBad(user: IUser, posts: IPost[]) {
            this.setData({ user });
            this.setData({ posts });
            this.setData({ totalCount: posts.length });
        },

        // GOOD: Single batched setData
        updateUserGood(user: IUser, posts: IPost[]) {
            this.setData({
                user,
                posts,
                totalCount: posts.length,
            });
        },

        // GOOD: Update nested property
        updateUserName(name: string) {
            this.setData({
                'user.name': name,
            });
        },

        // GOOD: Update array item
        updatePost(index: number, post: IPost) {
            this.setData({
                [`posts[${index}]`]: post,
            });
        },
    });
    ```

### Event Handlers

- Name event handlers with `handle` prefix
- Always type event parameters
- Extract dataset for custom data
- Example:

    ```typescript
    Page({
        data: {
            items: [] as IItem[],
        },

        handleTap(event: WechatMiniprogram.TouchEvent) {
            console.log('Tapped at:', event.detail);
        },

        handleItemTap(event: WechatMiniprogram.TouchEvent) {
            const { id, name } = event.currentTarget.dataset;
            console.log('Item tapped:', id, name);
            this.navigateToDetail(id as string);
        },

        handleInput(event: WechatMiniprogram.Input) {
            const value = event.detail.value;
            this.setData({ searchQuery: value });
        },

        handleSubmit(event: WechatMiniprogram.FormSubmit) {
            const formData = event.detail.value;
            this.submitForm(formData);
        },

        navigateToDetail(id: string) {
            wx.navigateTo({
                url: `/pages/detail/detail?id=${id}`,
            });
        },

        submitForm(data: Record<string, unknown>) {
            // Form submission logic
        },
    });
    ```

## Page Navigation

### Navigation Methods

- Use correct navigation method for each scenario
- Example:

    ```typescript
    // Navigate to new page (with back button)
    wx.navigateTo({
        url: '/pages/detail/detail?id=123',
        success: () => console.log('Navigation success'),
        fail: error => console.error('Navigation failed:', error),
    });

    // Redirect to page (no back button, replaces current page)
    wx.redirectTo({
        url: '/pages/result/result',
    });

    // Navigate to tab bar page
    wx.switchTab({
        url: '/pages/index/index',
    });

    // Go back
    wx.navigateBack({
        delta: 1, // Go back 1 page
    });

    // Redirect to any page (clears page stack)
    wx.reLaunch({
        url: '/pages/index/index',
    });
    ```

### Pass Data Between Pages

- Use URL query parameters for simple data
- Use event channels for complex data
- Use global data for shared state
- Example:

    ```typescript
    // Method 1: URL query parameters (simple data)
    wx.navigateTo({
        url: `/pages/detail/detail?id=${userId}&name=${userName}`,
    });

    // Receiving page
    Page({
        onLoad(options: Record<string, string | undefined>) {
            const { id, name } = options;
            console.log('Received:', id, name);
        },
    });

    // Method 2: Event channel (complex data)
    wx.navigateTo({
        url: '/pages/detail/detail',
        success: res => {
            res.eventChannel.emit('userData', { user: complexUserObject });
        },
    });

    // Receiving page
    Page({
        onLoad() {
            const eventChannel = this.getOpenerEventChannel();
            eventChannel.on('userData', (data: { user: IUser }) => {
                console.log('Received user:', data.user);
                this.setData({ user: data.user });
            });
        },
    });

    // Method 3: Global data (shared state)
    const app = getApp<IAppOption>();
    app.globalData.selectedItem = item;

    // In target page
    const app = getApp<IAppOption>();
    const item = app.globalData.selectedItem;
    ```

## Storage Management

### Use Storage Properly

- Use sync methods for simple operations
- Use async methods for large data
- Always handle errors
- Example:

    ```typescript
    // Synchronous storage (simple, small data)
    class StorageService {
        static save(key: string, value: unknown): void {
            try {
                wx.setStorageSync(key, value);
            } catch (error) {
                console.error('Failed to save to storage:', error);
            }
        }

        static load<T>(key: string): T | null {
            try {
                const value = wx.getStorageSync(key);
                return value ? (value as T) : null;
            } catch (error) {
                console.error('Failed to load from storage:', error);
                return null;
            }
        }

        static remove(key: string): void {
            try {
                wx.removeStorageSync(key);
            } catch (error) {
                console.error('Failed to remove from storage:', error);
            }
        }

        static clear(): void {
            try {
                wx.clearStorageSync();
            } catch (error) {
                console.error('Failed to clear storage:', error);
            }
        }
    }

    // Asynchronous storage (large data)
    class AsyncStorageService {
        static async save(key: string, value: unknown): Promise<void> {
            return new Promise((resolve, reject) => {
                wx.setStorage({
                    key,
                    data: value,
                    success: () => resolve(),
                    fail: error => reject(error),
                });
            });
        }

        static async load<T>(key: string): Promise<T | null> {
            return new Promise((resolve, reject) => {
                wx.getStorage({
                    key,
                    success: res => resolve(res.data as T),
                    fail: () => resolve(null),
                });
            });
        }
    }
    ```

### Storage Best Practices

- Use typed storage wrappers
- Don't store sensitive data unencrypted
- Clean up unused storage
- Example:

    ```typescript
    // Typed storage wrapper
    class TypedStorage<T> {
        constructor(private key: string) {}

        save(value: T): void {
            wx.setStorageSync(this.key, JSON.stringify(value));
        }

        load(): T | null {
            try {
                const value = wx.getStorageSync(this.key);
                return value ? (JSON.parse(value) as T) : null;
            } catch (error) {
                console.error('Failed to parse storage value:', error);
                return null;
            }
        }

        clear(): void {
            wx.removeStorageSync(this.key);
        }
    }

    // Usage
    interface IUserSettings {
        theme: 'light' | 'dark';
        language: string;
    }

    const settingsStorage = new TypedStorage<IUserSettings>('user_settings');
    settingsStorage.save({ theme: 'dark', language: 'zh-CN' });
    const settings = settingsStorage.load();
    ```

## API Request Management

### Promisify WeChat APIs

- Wrap callback-based APIs in Promises
- Create reusable request utilities
- Example:

    ```typescript
    // utils/request.ts
    interface IRequestOptions {
        url: string;
        method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
        data?: Record<string, unknown>;
        header?: Record<string, string>;
    }

    interface IApiResponse<T> {
        code: number;
        data: T;
        message: string;
    }

    class HttpClient {
        private baseUrl = 'https://api.example.com';

        async request<T>(options: IRequestOptions): Promise<T> {
            return new Promise((resolve, reject) => {
                wx.request({
                    url: this.baseUrl + options.url,
                    method: options.method || 'GET',
                    data: options.data,
                    header: {
                        'Content-Type': 'application/json',
                        ...options.header,
                    },
                    success: res => {
                        const response = res.data as IApiResponse<T>;
                        if (response.code === 200) {
                            resolve(response.data);
                        } else {
                            reject(new Error(response.message));
                        }
                    },
                    fail: error => {
                        reject(error);
                    },
                });
            });
        }

        async get<T>(url: string, data?: Record<string, unknown>): Promise<T> {
            return this.request<T>({ url, method: 'GET', data });
        }

        async post<T>(url: string, data?: Record<string, unknown>): Promise<T> {
            return this.request<T>({ url, method: 'POST', data });
        }
    }

    export const httpClient = new HttpClient();
    ```

### Usage in Pages

- Handle loading and error states
- Example:

    ```typescript
    // In page
    import { httpClient } from '../../utils/request';

    interface IUser {
        id: string;
        name: string;
    }

    Page({
        data: {
            user: null as IUser | null,
            isLoading: false,
            error: null as string | null,
        },

        async onLoad(options: Record<string, string | undefined>) {
            const { id } = options;
            if (id) {
                await this.loadUser(id);
            }
        },

        async loadUser(id: string) {
            this.setData({ isLoading: true, error: null });

            try {
                const user = await httpClient.get<IUser>(`/users/${id}`);
                this.setData({ user, isLoading: false });
            } catch (error) {
                const errorMessage =
                    error instanceof Error
                        ? error.message
                        : 'Failed to load user';

                this.setData({
                    error: errorMessage,
                    isLoading: false,
                });

                wx.showToast({
                    title: errorMessage,
                    icon: 'none',
                });
            }
        },
    });
    ```

## Error Handling

### Global Error Handling

- Implement `onError` in App instance
- Report errors to monitoring service
- Example:

    ```typescript
    // app.ts
    App<IAppOption>({
        onError(error: string) {
            console.error('App error:', error);
            this.reportError(error);
        },

        reportError(error: string) {
            // Send to error monitoring service
            wx.request({
                url: 'https://api.example.com/errors',
                method: 'POST',
                data: {
                    error,
                    timestamp: Date.now(),
                    userInfo: this.globalData.userInfo,
                },
            });
        },
    });
    ```

### Page-level Error Handling

- Show user-friendly error messages
- Provide recovery options
- Example:

    ```typescript
    Page({
        handleError(error: unknown, userMessage: string) {
            console.error('Error occurred:', error);

            wx.showModal({
                title: '错误',
                content: userMessage,
                showCancel: true,
                confirmText: '重试',
                success: res => {
                    if (res.confirm) {
                        this.retryOperation();
                    }
                },
            });
        },

        retryOperation() {
            // Retry logic
        },
    });
    ```

## Logic Layer Checklist (For AI Tools)

Before writing logic layer code, ensure:

- [ ] App instance uses `App<IAppOption>()`
- [ ] Pages use `Page()` with proper lifecycle hooks
- [ ] Page data has TypeScript interface defined
- [ ] All `setData` calls are batched when possible
- [ ] Event handlers are properly typed
- [ ] Navigation uses correct method for scenario
- [ ] Storage operations have error handling
- [ ] API requests are promisified and typed
- [ ] Loading and error states are managed
- [ ] Global errors are caught and reported
