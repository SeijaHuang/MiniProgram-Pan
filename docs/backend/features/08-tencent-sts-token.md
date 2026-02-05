# Feature: 腾讯云 STS Token 获取

## 概述

为小程序客户端提供腾讯云临时安全凭证（STS Token），使客户端能够安全地直连腾讯云实时语音识别（ASR）服务，而无需在客户端存储永久密钥。

## 业务场景

在实时语音识别场景中，客户端需要直接与腾讯云 ASR 服务通信以获得低延迟的语音识别能力。为了避免在小程序端暴露永久的 SecretId 和 SecretKey，采用 STS（Security Token Service）机制，由后端服务器动态生成具有时效性和权限限制的临时凭证。

### 使用流程

```
1. 小程序客户端需要开始 ASR 会话
   ↓
2. 客户端请求后端 GET /tencent/credentials
   ↓
3. 后端使用永久密钥调用腾讯云 STS 服务
   ↓
4. 腾讯云 STS 返回临时凭证（Token, TmpSecretId, TmpSecretKey）
   ↓
5. 后端将临时凭证返回给客户端
   ↓
6. 客户端使用临时凭证直连腾讯云 ASR 服务
   ↓
7. 临时凭证过期后，客户端重新请求新凭证
```

---

## API 接口

### Endpoint

```
GET /tencent/credentials
```

### Request

无需请求参数

### Response

**成功响应** (200 OK):

```typescript
{
  "Credentials": {
    "Token": string,           // 临时安全令牌
    "TmpSecretId": string,     // 临时 SecretId
    "TmpSecretKey": string     // 临时 SecretKey
  },
  "Expiration": string,        // 过期时间（ISO 8601 格式）
  "ExpiredTime": number,       // 过期时间戳（秒）
  "RequestId": string          // 请求ID
}
```

**失败响应** (500 Internal Server Error):

```typescript
{
  "success": false,
  "error": {
    "code": "STS_GET_FAILED",
    "message": string
  }
}
```

---

## 技术实现

### 1. 依赖包

```json
{
  "tencentcloud-sdk-nodejs-sts": "^4.1.100"
}
```

### 2. 环境变量配置

在 `.env` 文件中配置腾讯云永久密钥：

```bash
# Tencent Cloud Configuration
TENCENT_SECRET_ID=YOUR_TENCENT_SECRET_ID
TENCENT_SECRET_KEY=YOUR_TENCENT_SECRET_KEY
TENCENT_REGION=ap-guangzhou
```

### 3. 配置常量

`src/constants/config.ts`:

```typescript
export const TENCENT_CONFIG = {
    SECRET_ID: process.env.TENCENT_SECRET_ID,
    SECRET_KEY: process.env.TENCENT_SECRET_KEY,
    REGION: process.env.TENCENT_REGION,
} as const;
```

### 4. Controller 实现

`src/controllers/tencent-controller.ts`:

```typescript
import { sts } from "tencentcloud-sdk-nodejs-sts"
import { GetFederationTokenRequest, GetFederationTokenResponse } from 'tencentcloud-sdk-nodejs-sts/tencentcloud/services/sts/v20180813/sts_models';
import { TENCENT_CONFIG } from '../constants/config';

const StsClient = sts.v20180813.Client;

// 初始化 STS 客户端
const stsClient = new StsClient({
  credential: {
    secretId: TENCENT_CONFIG.SECRET_ID,
    secretKey: TENCENT_CONFIG.SECRET_KEY,
  },
  region: TENCENT_CONFIG.REGION,
});

// 定义临时凭证的权限策略（仅限 ASR 服务）
const policy = {
  version: "2.0",
  statement: [{ 
    effect: "allow", 
    action: ["name/asr:*"], 
    resource: "*" 
  }],
};

export class TencentController {
    static async getSTSToken(req: Request, res: Response): Promise<void> {
        try {
            const response = await this._getSTSToken();
            res.status(200).json(response);
        } catch (error: unknown) {
            console.error('[TencentController] Get STS token failed:', error);
            const response: IBaseResponse<never> = {
                success: false,
                error: {
                    code: EHttpErrorCode.STSGetFailed,
                    message: error instanceof Error ? error.message : 'Unknown error',
                },
            };
            res.status(500).json(response);
        }
    }

    private static _getSTSToken(): Promise<GetFederationTokenResponse> {
        const getFederationTokenRequest: GetFederationTokenRequest = {
            Name: "pan-asr",  // 临时凭证名称
            Policy: JSON.stringify(policy),
        };
        return stsClient.GetFederationToken(getFederationTokenRequest);
    }
}
```

### 5. 路由注册

`src/routes/tencent-routes.ts`:

```typescript
import { Router } from 'express';
import { TencentController } from './../controllers/tencent-controller';

const router = Router();

router.get('/credentials', TencentController.getSTSToken.bind(TencentController));

export default router;
```

`src/app.ts`:

```typescript
import tencentRoutes from './routes/tencent-routes';

app.use('/tencent', tencentRoutes);
```

---

## 安全机制

### 1. 权限最小化原则

临时凭证的权限被严格限制为：

```json
{
  "effect": "allow",
  "action": ["name/asr:*"],  // 仅限 ASR 服务
  "resource": "*"
}
```

这意味着：
- ✅ 可以访问腾讯云实时语音识别服务
- ❌ 无法访问其他腾讯云服务（如 COS、VOD 等）
- ❌ 无法修改账号配置或权限

### 2. 时效性保护

- 临时凭证有有效期（通常为 1-2 小时）
- 过期后自动失效，需重新获取
- 即使凭证泄露，影响时间窗口有限

### 3. 永久密钥隔离

- 永久密钥（SecretId/SecretKey）仅存储在后端服务器
- 客户端永远不会接触到永久密钥
- 后端通过 `.env` 和环境变量管理敏感信息

---

## 错误处理

### 可能的错误场景

| 错误场景 | HTTP 状态码 | 错误代码 | 原因 |
|---------|-----------|---------|------|
| 腾讯云密钥无效 | 500 | STS_GET_FAILED | 环境变量中的密钥配置错误 |
| 网络连接失败 | 500 | STS_GET_FAILED | 无法连接腾讯云 STS 服务 |
| 权限策略错误 | 500 | STS_GET_FAILED | Policy JSON 格式错误 |
| 腾讯云服务异常 | 500 | STS_GET_FAILED | 腾讯云服务暂时不可用 |

### 错误响应示例

```json
{
  "success": false,
  "error": {
    "code": "STS_GET_FAILED",
    "message": "InvalidCredentials: The provided credentials are invalid"
  }
}
```

---

## 使用示例

### 客户端请求示例（微信小程序）

```typescript
// 获取腾讯云临时凭证
async function getTencentCredentials(): Promise<TencentCredentials> {
    try {
        const response = await wx.request({
            url: 'http://localhost:8080/tencent/credentials',
            method: 'GET',
        });

        if (response.statusCode === 200 && response.data) {
            return {
                token: response.data.Credentials.Token,
                tmpSecretId: response.data.Credentials.TmpSecretId,
                tmpSecretKey: response.data.Credentials.TmpSecretKey,
                expiredTime: response.data.ExpiredTime,
            };
        }

        throw new Error('Failed to get credentials');
    } catch (error) {
        console.error('Get credentials error:', error);
        throw error;
    }
}

// 使用临时凭证初始化 ASR 服务
async function initASRService(): Promise<void> {
    const credentials = await getTencentCredentials();
    
    // 使用临时凭证连接腾讯云 ASR
    asrClient.init({
        secretId: credentials.tmpSecretId,
        secretKey: credentials.tmpSecretKey,
        token: credentials.token,
    });
    
    console.log('ASR service initialized with temporary credentials');
    console.log('Credentials will expire at:', new Date(credentials.expiredTime * 1000));
}
```

### cURL 测试示例

```bash
# 获取 STS Token
curl -X GET http://localhost:8080/tencent/credentials

# 预期成功响应
{
  "Credentials": {
    "Token": "xxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "TmpSecretId": "AKIDxxxxxxxxxxxxxx",
    "TmpSecretKey": "xxxxxxxxxxxxxxxx"
  },
  "Expiration": "2026-02-02T12:00:00Z",
  "ExpiredTime": 1738497600,
  "RequestId": "abcd1234-5678-90ef-ghij-klmnopqrstuv"
}
```

---

## 配置检查清单

在使用此功能前，请确保：

- [ ] 已安装 `tencentcloud-sdk-nodejs-sts` 依赖包
- [ ] `.env` 文件中已配置 `TENCENT_SECRET_ID`
- [ ] `.env` 文件中已配置 `TENCENT_SECRET_KEY`
- [ ] `.env` 文件中已配置 `TENCENT_REGION`（如 `ap-guangzhou`）
- [ ] 腾讯云密钥对应的账号已开通实时语音识别服务
- [ ] 后端服务器能够访问腾讯云 API（检查网络和防火墙）

---

## 监控和日志

### 日志记录

```typescript
// 成功获取 Token
console.log('[TencentController] STS token retrieved successfully');

// 失败情况
console.error('[TencentController] Get STS token failed:', error);
```

### 建议的监控指标

1. **请求成功率**: 监控 `/tencent/credentials` 的 200 vs 500 响应比例
2. **响应时间**: 腾讯云 STS API 调用的延迟
3. **错误率趋势**: 检测密钥过期或权限问题
4. **Token 使用频率**: 评估客户端的凭证刷新策略是否合理

---

## 性能考虑

### Token 缓存策略（可选优化）

当前实现每次请求都调用腾讯云 STS API。如果请求频繁，可以考虑在后端缓存 Token：

```typescript
// 伪代码示例（未实现）
class TokenCache {
    private cachedToken: GetFederationTokenResponse | null = null;
    private expireTime: number = 0;

    async getToken(): Promise<GetFederationTokenResponse> {
        const now = Date.now() / 1000;
        
        // 如果 Token 还有 5 分钟以上有效期，直接返回缓存
        if (this.cachedToken && this.expireTime - now > 300) {
            return this.cachedToken;
        }

        // 否则重新获取
        this.cachedToken = await stsClient.GetFederationToken(...);
        this.expireTime = this.cachedToken.ExpiredTime;
        
        return this.cachedToken;
    }
}
```

**优点**: 减少对腾讯云 STS API 的调用次数
**缺点**: 增加实现复杂度，需要处理多实例缓存一致性

---

## 扩展性

### 未来可能的增强

1. **支持多种权限策略**
   - 根据用户角色返回不同权限的临时凭证
   - 例如：管理员获得更多权限

2. **支持其他腾讯云服务**
   - COS（对象存储）
   - VOD（点播）
   - 等等

3. **Token 刷新机制**
   - 提供 `/tencent/credentials/refresh` 接口
   - 在 Token 即将过期时主动刷新

4. **用户级别的凭证隔离**
   - 为不同用户生成独立的临时凭证
   - 便于审计和权限控制

---

## 相关文档

- [API 规格说明](../api-specification.md)
- [ASR 实时语音识别](07-asr-real-time-speech.md)
- [环境变量配置](../../backend/.env.example)
- [腾讯云 STS 官方文档](https://cloud.tencent.com/document/product/598/33416)

---

## 总结

STS Token 获取功能为小程序提供了安全、便捷的方式访问腾讯云 ASR 服务：

- ✅ **安全**: 永久密钥不暴露给客户端
- ✅ **可控**: 权限范围受限，仅限 ASR 服务
- ✅ **时效**: 临时凭证自动过期，降低泄露风险
- ✅ **简单**: 客户端只需一次 HTTP 请求即可获取凭证

这种架构遵循了"最小权限原则"和"深度防御"的安全最佳实践。
