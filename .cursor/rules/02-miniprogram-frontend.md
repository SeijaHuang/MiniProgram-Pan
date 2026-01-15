# WeChat Mini Program Frontend Rules

**CRITICAL**: Frontend code must follow WeChat Mini Program native framework patterns.

## WXML (Template) Rules

### Data Binding

- Use Mustache syntax `{{ }}` for data binding
- Keep logic out of templates - compute in TypeScript
- Example:

    ```xml
    <!-- BAD: Logic in template -->
    <view>{{ user.name.length > 10 ? user.name.substring(0, 10) + '...' : user.name }}</view>

    <!-- GOOD: Computed in TypeScript -->
    <view>{{ displayName }}</view>
    ```

    ```typescript
    // In TypeScript
    data: {
        displayName: '',
    },
    onLoad() {
        const name = this.data.user.name;
        this.setData({
            displayName: name.length > 10 ? name.substring(0, 10) + '...' : name,
        });
    }
    ```

### List Rendering

- Always use `wx:key` for list rendering
- Use unique identifiers, not index
- Example:

    ```xml
    <!-- BAD: No wx:key -->
    <view wx:for="{{ items }}">{{ item.name }}</view>

    <!-- BAD: Using index as key -->
    <view wx:for="{{ items }}" wx:key="index">{{ item.name }}</view>

    <!-- GOOD: Unique identifier as key -->
    <view wx:for="{{ items }}" wx:key="id">{{ item.name }}</view>
    ```

### Conditional Rendering

- Use `wx:if` for rare toggles (removes from DOM)
- Use `hidden` for frequent toggles (display:none)
- Example:

    ```xml
    <!-- Use wx:if when condition rarely changes -->
    <view wx:if="{{ userRole === 'admin' }}">Admin Panel</view>

    <!-- Use hidden for frequent toggles -->
    <view hidden="{{ !isLoading }}">Loading...</view>
    ```

### Event Binding

- Use `bind` prefix for bubbling events
- Use `catch` prefix to stop event propagation
- Use `data-*` attributes to pass custom data
- Example:

    ```xml
    <!-- Bubbling event -->
    <button bindtap="handleTap">Click Me</button>

    <!-- Stop propagation -->
    <button catchtap="handleTap">Click Me</button>

    <!-- Pass custom data -->
    <button bindtap="handleTap" data-id="{{ item.id }}" data-name="{{ item.name }}">
        {{ item.name }}
    </button>
    ```

    ```typescript
    // In TypeScript
    handleTap(event: WechatMiniprogram.TouchEvent) {
        const { id, name } = event.currentTarget.dataset;
        console.log('Tapped item:', id, name);
    }
    ```

### Template Organization

- Keep templates clean and readable
- Use proper indentation (2 spaces for WXML)
- Group related elements
- Example:

    ```xml
    <!-- GOOD: Well-organized template -->
    <view class="container">
        <!-- Header Section -->
        <view class="header">
            <text class="title">{{ title }}</text>
        </view>

        <!-- Content Section -->
        <view class="content">
            <view wx:for="{{ items }}" wx:key="id" class="item">
                <text>{{ item.name }}</text>
            </view>
        </view>

        <!-- Footer Section -->
        <view class="footer">
            <button bindtap="handleSubmit">Submit</button>
        </view>
    </view>
    ```

## WXSS (Styling) Rules

### Use rpx Units

- Use `rpx` for responsive sizing (750rpx = screen width)
- Use `px` only for fixed sizes or borders
- Example:

    ```css
    /* GOOD: Responsive with rpx */
    .container {
        width: 750rpx;
        padding: 20rpx;
    }

    .item {
        width: 690rpx;
        height: 100rpx;
        margin: 10rpx 30rpx;
    }

    /* Use px for borders */
    .border {
        border: 1px solid #e5e5e5;
    }
    ```

### Class Naming Conventions

- Use BEM (Block Element Modifier) naming
- Use kebab-case for class names
- Example:

    ```css
    /* Block */
    .user-card {
    }

    /* Element */
    .user-card__avatar {
    }
    .user-card__name {
    }
    .user-card__bio {
    }

    /* Modifier */
    .user-card--highlighted {
    }
    .user-card--compact {
    }
    ```

### Avoid Inline Styles

- Use class names instead of inline styles
- Only use inline styles for dynamic values
- Example:

    ```xml
    <!-- BAD: Static inline styles -->
    <view style="width: 100rpx; height: 100rpx; background: red;"></view>

    <!-- GOOD: Use class -->
    <view class="red-box"></view>

    <!-- GOOD: Dynamic style (when value comes from data) -->
    <view style="background: {{ themeColor }};"></view>
    ```

### Flexbox Layout

- Use Flexbox for layouts (default in WeChat Mini Program)
- Example:

    ```css
    /* Horizontal layout */
    .row {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
    }

    /* Vertical layout */
    .column {
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    /* Center content */
    .center {
        display: flex;
        align-items: center;
        justify-content: center;
    }
    ```

### Global vs Page Styles

- Put common styles in `app.wxss`
- Keep page-specific styles in page `.wxss` files
- Don't duplicate styles across pages
- Example:

    ```css
    /* app.wxss - Global styles */
    .container {
        padding: 20rpx;
    }

    .btn-primary {
        background-color: #07c160;
        color: #fff;
    }

    /* pages/index/index.wxss - Page-specific styles */
    .index-hero {
        height: 400rpx;
        background: linear-gradient(to bottom, #667eea, #764ba2);
    }
    ```

## Component Rules

### Component Structure

- Create components in `components/` directory
- Each component has 4 files: `.ts`, `.wxml`, `.wxss`, `.json`
- Example structure:
    ```
    components/
    └── user-card/
        ├── user-card.ts      # Component logic
        ├── user-card.wxml    # Component template
        ├── user-card.wxss    # Component styles
        └── user-card.json    # Component config
    ```

### Component Definition

- Use `Component()` constructor
- Define properties with proper types
- Example:
    ```typescript
    // user-card.ts
    Component({
        properties: {
            user: {
                type: Object,
                value: null,
            },
            size: {
                type: String,
                value: 'medium',
            },
        },
        data: {
            isExpanded: false,
        },
        methods: {
            handleTap() {
                this.setData({ isExpanded: !this.data.isExpanded });
                this.triggerEvent('tap', { user: this.properties.user });
            },
        },
    });
    ```

### Component JSON Config

- Set `component: true` in JSON file
- Example:
    ```json
    {
        "component": true,
        "usingComponents": {}
    }
    ```

### Component Communication

- Use `properties` for parent-to-child data
- Use `triggerEvent` for child-to-parent events
- Example:
    ```xml
    <!-- Parent page -->
    <user-card user="{{ currentUser }}" bind:tap="handleUserTap"></user-card>
    ```
    ```typescript
    // Parent TypeScript
    handleUserTap(event: WechatMiniprogram.CustomEvent) {
        const { user } = event.detail;
        console.log('User tapped:', user);
    }
    ```

## Animation Rules (MANDATORY)

### Use wx.createAnimation ONLY

- **FORBIDDEN**: CSS transitions, CSS animations, transform, etc.
- **REQUIRED**: Use `wx.createAnimation()` API for ALL animations
- Example:

    ```typescript
    // GOOD: Using wx.createAnimation
    Page({
        data: {
            animationData: {},
        },
        animateElement() {
            const animation = wx.createAnimation({
                duration: 300,
                timingFunction: 'ease',
                delay: 0,
            });

            animation.translateX(100).rotate(45).step();

            this.setData({
                animationData: animation.export(),
            });
        },
    });
    ```

    ```xml
    <!-- In WXML -->
    <view animation="{{ animationData }}" class="box"></view>
    ```

### Animation Best Practices

- Chain multiple animation steps with `.step()`
- Reset animation by creating new instance
- Example:

    ```typescript
    // Multiple animation steps
    animateSequence() {
        const animation = wx.createAnimation({ duration: 300 });

        // Step 1: Move right
        animation.translateX(100).step();

        // Step 2: Move down
        animation.translateY(100).step();

        // Step 3: Fade out
        animation.opacity(0).step();

        this.setData({ animationData: animation.export() });
    }

    // Reset animation
    resetAnimation() {
        const animation = wx.createAnimation({ duration: 0 });
        animation.translateX(0).translateY(0).opacity(1).step();
        this.setData({ animationData: animation.export() });
    }
    ```

### Common Animation Patterns

- Create reusable animation utilities
- Example:

    ```typescript
    // utils/animations.ts
    export class AnimationHelper {
        static fadeIn(duration: number = 300): WechatMiniprogram.Animation {
            const animation = wx.createAnimation({ duration });
            return animation.opacity(1).step();
        }

        static fadeOut(duration: number = 300): WechatMiniprogram.Animation {
            const animation = wx.createAnimation({ duration });
            return animation.opacity(0).step();
        }

        static slideInFromRight(
            distance: number = 100,
            duration: number = 300
        ): WechatMiniprogram.Animation {
            const animation = wx.createAnimation({ duration });
            return animation.translateX(0).step();
        }
    }
    ```

## Performance Optimization

### Avoid Frequent setData

- Batch multiple updates into single `setData` call
- Only update changed data, not entire data object
- Example:

    ```typescript
    // BAD: Multiple setData calls
    this.setData({ name: 'John' });
    this.setData({ age: 25 });
    this.setData({ city: 'Beijing' });

    // GOOD: Single batched setData
    this.setData({
        name: 'John',
        age: 25,
        city: 'Beijing',
    });

    // GOOD: Update specific array item
    this.setData({
        [`items[${index}].name`]: 'New Name',
    });
    ```

### Lazy Load Images

- Use `lazy-load` attribute for images
- Example:
    ```xml
    <image src="{{ imageUrl }}" lazy-load="{{ true }}" mode="aspectFill"></image>
    ```

### List Virtualization

- For long lists, consider virtual scrolling
- Use `scroll-view` with controlled rendering
- Example:
    ```xml
    <scroll-view scroll-y="{{ true }}" style="height: 100vh;">
        <view wx:for="{{ visibleItems }}" wx:key="id">
            {{ item.name }}
        </view>
    </scroll-view>
    ```

## Frontend Checklist (For AI Tools)

Before writing frontend code, ensure:

- [ ] WXML uses proper data binding (no logic in templates)
- [ ] All `wx:for` have `wx:key` with unique identifiers
- [ ] Events use `data-*` attributes for custom data
- [ ] WXSS uses `rpx` units for responsive sizing
- [ ] Class names follow BEM convention
- [ ] Animations use `wx.createAnimation()` ONLY (no CSS animations)
- [ ] `setData` calls are batched and efficient
- [ ] Images use `lazy-load` when appropriate
- [ ] Components follow proper structure and communication patterns
