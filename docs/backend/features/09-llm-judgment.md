# 09. LLM 判决书生成

## 概述

基于双方发言内容，调用 OpenAI LLM 生成搞笑风格的 AI 判决结果，包含责任分布、六维雷达图评分和大老爷赠言。

---

## HTTP 接口

### POST /v1/rooms/:roomId/judgments

**描述**: 创建 AI 判决

#### 请求

**URL Parameters**:
- `roomId`: 房间 ID（必填）

**Body**:
```typescript
{
  "player1Speech": string,      // 玩家1发言内容（1-8000 字符）
  "player2Speech": string,      // 玩家2发言内容（1-8000 字符）
  "idempotencyKey"?: string     // 幂等键（可选，最长128字符）
}
```

**验证 Schema**: `CreateJudgmentBodySchema` + `RoomIdParamSchema`

#### 响应

**成功 (200)**:
```typescript
{
  "success": true,
  "data": {
    "caseNumber": string,          // 案件编号，如 "NO.12345"
    "responsibility": {
      "player1": number,           // 0-100
      "player2": number,           // 0-100
      "thirdParty": {
        "factors": [
          {
            "name": string,        // 搞笑因素名称
            "percentage": number
          }
        ]
      }
    },
    "radarChart": {
      "player1": {
        "嘴硬程度": number,        // 0-100
        "翻旧账": number,
        "逻辑滑坡": number,
        "撒娇暴击": number,
        "求生欲": number,
        "受害者演技": number
      },
      "player2": {
        // 同上六个维度
      }
    },
    "verdict": string              // 大老爷赠言（50-100 字符）
  }
}
```

**错误**:
- `400 INVALID_REQUEST` — 请求参数验证失败
- `502 LLM_CALL_FAILED` — OpenAI API 调用失败

---

## 架构

### 数据流

```
客户端
  ↓ POST /v1/rooms/:roomId/judgments
routes/llm-judgement.routes.ts
  ↓
controllers/llm-judgement.controller.ts
  ↓ 验证 CreateJudgmentBodySchema + RoomIdParamSchema
services/core/llm-judgement.service.ts
  ↓
clients/openai.client.ts
  ↓ OpenAI Chat Completion API
OpenAI 服务器
  ↓ JSON 响应
  ↓ 解析 + 验证结构
返回 IJudgmentResponse
```

### 涉及文件

| 文件 | 职责 |
|------|------|
| `routes/llm-judgement.routes.ts` | 路由定义 |
| `controllers/llm-judgement.controller.ts` | 请求处理、验证、响应格式化 |
| `services/core/llm-judgement.service.ts` | 业务逻辑编排 |
| `clients/openai.client.ts` | OpenAI API 调用封装 |
| `constants/prompts.ts` | System Prompt 模板 |
| `models/schemas/llm-request.schema.ts` | Zod 验证 Schema |
| `types/llm/judgment.ts` | TypeScript 类型定义 |

---

## OpenAI 集成细节

### 配置

| 参数 | 值 | 说明 |
|------|----|----|
| 模型 | `gpt-4o`（可配置） | 通过 `OPENAI_MODEL` 环境变量 |
| Temperature | `0.7` | 保证创意性 |
| 超时 | `60000ms` | 防止长时间等待 |
| 响应格式 | JSON | 强制 JSON 输出 |

### 环境变量

```bash
OPENAI_API_KEY=sk-...              # 必需
OPENAI_MODEL=gpt-4o               # 可选，默认 gpt-4o
OPENAI_BASE_URL=...               # 可选，自定义端点
```

### Prompt 结构

- **System Prompt**: 定义清汤大老爷角色和输出 JSON 格式（位于 `constants/prompts.ts`）
- **User Content**: 包含双方发言文本

---

## 六维雷达图维度

| 维度 | 说明 |
|------|------|
| 嘴硬程度 | 坚持己见、不肯认错的程度 |
| 翻旧账 | 提及过往事件的频率和程度 |
| 逻辑滑坡 | 论证跳跃、逻辑不严密的程度 |
| 撒娇暴击 | 使用撒娇/卖萌来影响对方的能力 |
| 求生欲 | 意识到危险并试图挽回的能力 |
| 受害者演技 | 扮演受害者角色的演技水平 |

每个维度评分范围: 0-100

---

## 错误处理

| 场景 | 错误码 | HTTP 状态码 |
|------|--------|-----------|
| 请求参数无效 | `INVALID_REQUEST` | 400 |
| OpenAI API 调用失败 | `LLM_CALL_FAILED` | 502 |
| JSON 解析失败 | `LLM_CALL_FAILED` | 502 |
| 请求超时（>60s） | `LLM_CALL_FAILED` | 502 |

---

## 示例

### 请求

```bash
curl -X POST http://localhost:8080/v1/rooms/room_123456/judgments \
  -H "Content-Type: application/json" \
  -d '{
    "player1Speech": "你总是不听我说话，每次都自己做决定！",
    "player2Speech": "我哪有，你才是每次都不考虑我的感受！"
  }'
```

### 响应

```json
{
  "success": true,
  "data": {
    "caseNumber": "NO.23456",
    "responsibility": {
      "player1": 40,
      "player2": 45,
      "thirdParty": {
        "factors": [
          { "name": "水星逆行", "percentage": 10 },
          { "name": "空调温度分歧", "percentage": 5 }
        ]
      }
    },
    "radarChart": {
      "player1": {
        "嘴硬程度": 75,
        "翻旧账": 60,
        "逻辑滑坡": 40,
        "撒娇暴击": 30,
        "求生欲": 85,
        "受害者演技": 50
      },
      "player2": {
        "嘴硬程度": 65,
        "翻旧账": 80,
        "逻辑滑坡": 55,
        "撒娇暴击": 70,
        "求生欲": 40,
        "受害者演技": 60
      }
    },
    "verdict": "本官判定双方各打五十大板，建议下次吵架前先喝杯奶茶冷静一下。"
  }
}
```

---

## 相关文档

- [API 规格说明](../api-specification.md)
- [数据模型](../data-models.md)
- [产品需求](../product-requirements.md)
