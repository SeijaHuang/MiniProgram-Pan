# Backend Middleware

本文档描述后端中间件的实现和使用方法。

## 中间件架构

```
middlewares/
├── error/
│   └── error-handler.middleware.ts    # 错误处理
├── logging/
│   └── request-logger.middleware.ts   # 请求日志
└── validation/
    └── validation.middleware.ts       # 参数验证
```

---

## 错误处理中间件

集中处理所有 Express 错误。

**文件**: `backend/src/middlewares/error/error-handler.middleware.ts`

### AppError 类

自定义错误类，用于结构化错误：

```typescript
class AppError extends Error {
    public readonly statusCode: number;
    public readonly code: string;
    public readonly isOperational: boolean;

    constructor(
        message: string,
        statusCode: number = 500,
        code: string = 'INTERNAL_ERROR'
    ) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}
```

### 使用示例

```typescript
// 在控制器或服务中抛出错误
throw new AppError('房间不存在', 404, 'ROOM_NOT_FOUND');
```

### 错误处理器

```typescript
function errorHandler(
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
): void {
    if (err instanceof AppError) {
        // 业务错误
        res.status(err.statusCode).json({
            success: false,
            error: {
                code: err.code,
                message: err.message,
            },
        });
    } else {
        // 未知错误
        console.error('Unexpected error:', err);

        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message:
                    process.env.NODE_ENV === 'development'
                        ? err.message
                        : 'Internal server error',
            },
        });
    }
}
```

### 注册中间件

```typescript
// app.ts
import { errorHandler } from './middlewares/error/error-handler.middleware';

// 注册在所有路由之后
app.use(errorHandler);
```

---

## 请求日志中间件

记录所有 HTTP 请求的日志。

**文件**: `backend/src/middlewares/logging/request-logger.middleware.ts`

### 功能

- 记录请求方法、路径、时间戳
- 计算请求处理时长
- 记录慢请求警告

### 实现

```typescript
function requestLogger(
    req: Request,
    res: Response,
    next: NextFunction
): void {
    const startTime = Date.now();

    // 请求开始日志
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);

    // 响应完成后记录
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const status = res.statusCode;

        console.log(
            `[${new Date().toISOString()}] ${req.method} ${req.path} - ${status} (${duration}ms)`
        );

        // 慢请求警告
        if (duration > 1000) {
            console.warn(
                `[SLOW REQUEST] ${req.method} ${req.path} took ${duration}ms`
            );
        }
    });

    next();
}
```

### 注册中间件

```typescript
// app.ts
import { requestLogger } from './middlewares/logging/request-logger.middleware';

// 注册在路由之前
app.use(requestLogger);
```

### 日志输出示例

```
[2024-01-25T10:30:00.000Z] POST /room/create
[2024-01-25T10:30:00.050Z] POST /room/create - 201 (50ms)
```

---

## 验证中间件

通用参数验证中间件工厂。

**文件**: `backend/src/middlewares/validation/validation.middleware.ts`

### 验证工厂

```typescript
import { z, ZodSchema } from 'zod';

interface IValidateOptions {
    body?: ZodSchema;
    params?: ZodSchema;
    query?: ZodSchema;
}

function validate(options: IValidateOptions) {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            if (options.body) {
                req.body = options.body.parse(req.body);
            }
            if (options.params) {
                req.params = options.params.parse(req.params);
            }
            if (options.query) {
                req.query = options.query.parse(req.query);
            }
            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: formatZodError(error),
                    },
                });
            } else {
                next(error);
            }
        }
    };
}

// 快捷方法
function validateBody(schema: ZodSchema) {
    return validate({ body: schema });
}

function validateParams(schema: ZodSchema) {
    return validate({ params: schema });
}

function validateQuery(schema: ZodSchema) {
    return validate({ query: schema });
}
```

### 使用示例

```typescript
import { validateBody } from './middlewares/validation/validation.middleware';
import { createRoomSchema } from './models/schemas/http-request.schema';

// 路由中使用
router.post('/room/create', validateBody(createRoomSchema), createRoom);
```

### 错误格式化

```typescript
function formatZodError(error: z.ZodError): string {
    return error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join('; ');
}
```

### 验证错误响应示例

```json
{
    "success": false,
    "error": {
        "code": "VALIDATION_ERROR",
        "message": "creator.userId: Required; creator.nickname: Required"
    }
}
```

---

## 中间件执行顺序

```
请求进入
    │
    ▼
[requestLogger]    ← 记录请求开始
    │
    ▼
[cors]             ← CORS 处理
    │
    ▼
[express.json()]   ← JSON 解析
    │
    ▼
[validate]         ← 参数验证 (在路由中)
    │
    ▼
[路由处理器]
    │
    ▼
[errorHandler]     ← 错误处理
    │
    ▼
响应返回
```

---

## 完整注册示例

```typescript
// app.ts
import express from 'express';
import cors from 'cors';
import { requestLogger } from './middlewares/logging/request-logger.middleware';
import { errorHandler } from './middlewares/error/error-handler.middleware';
import roomRoutes from './routes/room-routes';

const app = express();

// 1. 请求日志 (最先)
app.use(requestLogger);

// 2. CORS
app.use(cors());

// 3. JSON 解析
app.use(express.json());

// 4. 路由
app.use('/room', roomRoutes);

// 5. 健康检查
app.get('/health', (req, res) => {
    res.json({ ok: true });
});

// 6. 404 处理
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: `Route ${req.method} ${req.path} not found`,
        },
    });
});

// 7. 错误处理 (最后)
app.use(errorHandler);

export default app;
```

---

## 自定义中间件指南

### 创建新中间件

```typescript
// middlewares/custom/my-middleware.ts
import { Request, Response, NextFunction } from 'express';

function myMiddleware(req: Request, res: Response, next: NextFunction): void {
    // 中间件逻辑

    // 继续处理
    next();

    // 或者结束请求
    // res.status(401).json({ error: 'Unauthorized' });
}

export { myMiddleware };
```

### 异步中间件

```typescript
function asyncMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
): void {
    someAsyncOperation()
        .then(() => next())
        .catch(next); // 错误传递给错误处理器
}

// 或使用 async/await
const asyncMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        await someAsyncOperation();
        next();
    } catch (error) {
        next(error);
    }
};
```

### 中间件工厂

```typescript
function createAuthMiddleware(options: IAuthOptions) {
    return (req: Request, res: Response, next: NextFunction) => {
        // 使用 options 配置
        if (options.required && !req.headers.authorization) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        next();
    };
}

// 使用
app.use(createAuthMiddleware({ required: true }));
```

---

## 最佳实践

1. **错误传递**: 使用 `next(error)` 传递错误到错误处理器
2. **异步处理**: 确保异步操作的错误被捕获
3. **执行顺序**: 按功能正确排列中间件顺序
4. **单一职责**: 每个中间件只做一件事
5. **可配置性**: 使用工厂函数创建可配置的中间件
