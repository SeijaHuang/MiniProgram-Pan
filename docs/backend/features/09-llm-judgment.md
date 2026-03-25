# 09. LLM 判决书生成

## 概述

基于双方发言内容，调用 OpenAI LLM 生成搞笑风格的 AI 判决结果，包含责任分布、六维雷达图评分、大老爷赠言、惩罚任务和私密战报。

判决生成支持两种触发方式：
1. **WebSocket 驱动**（主流程）：Chat Room 双方发言结束后自动触发，通过 WebSocket 推送结果
2. **HTTP 直接调用**（备用）：通过 POST 接口直接调用 LLM

---

## WebSocket 判决流程（主流程）

### 完整流程

```
Chat Room 阶段
  ↓ ASR_TEXT_PUSH (isFinal: true) → 自动累积到 room.speechState
  ↓
SPEECH_TURN_END (第一人发言结束)
  ↓ speech-turn-end-handler
Server 广播 SPEECH_TURN_SWITCH → 客户端切换轮次
  ↓
SPEECH_TURN_END (第二人发言结束)
  ↓ speech-turn-end-handler → bothFinished = true
Server 广播 CHAT_COMPLETE → 客户端跳转至判决等待页
  ↓ (异步)
VerdictOrchestratorService.generateVerdict()
  ├─ 获取 room.speechState 中的 hostText, guestText
  ├─ 设置 verdictStatus = 'processing'
  ├─ 调用 llmJudgementService → OpenAI API (30s 超时)
  ├─ VerdictMapperService 转换为前端格式
  ├─ 缓存到 room.verdictResult, verdictStatus = 'completed'
  └─ 广播 VERDICT_RESULT
      或
  ├─ 设置 verdictStatus = 'failed', 递增 verdictRetryCount
  └─ 广播 VERDICT_FAILED (含 canRetry 标志)
```

### WebSocket 消息类型

| 消息类型 | 方向 | 说明 |
|---------|------|------|
| `SPEECH_TURN_END` | Client → Server | 玩家发言轮次结束 |
| `SPEECH_TURN_SWITCH` | Server → Client | 第一位发言者结束，切换轮次 |
| `CHAT_COMPLETE` | Server → Client | 双方发言结束，触发判决 |
| `VERDICT_RESULT` | Server → Client | 判决结果推送（成功） |
| `VERDICT_FAILED` | Server → Client | 判决生成失败 |
| `VERDICT_RETRY` | Client → Server | 请求重试判决 |

### 消息格式

#### SPEECH_TURN_END (Client → Server)
```typescript
{
  "type": "SPEECH_TURN_END",
  "data": {
    "roomId": string,
    "userId": string
  },
  "timestamp": number
}
```

#### SPEECH_TURN_SWITCH (Server → Client)
```typescript
{
  "type": "SPEECH_TURN_SWITCH",
  "data": {
    "roomId": string
  },
  "timestamp": number
}
```

#### CHAT_COMPLETE (Server → Client)
```typescript
{
  "type": "CHAT_COMPLETE",
  "data": {
    "roomId": string
  },
  "timestamp": number
}
```

#### VERDICT_RESULT (Server → Client)
```typescript
{
  "type": "VERDICT_RESULT",
  "data": {
    "roomId": string,
    "verdict": IVerdictResult  // 见下方数据结构
  },
  "timestamp": number
}
```

#### VERDICT_FAILED (Server → Client)
```typescript
{
  "type": "VERDICT_FAILED",
  "data": {
    "roomId": string,
    "error": string,
    "canRetry": boolean,
    "retryCount": number
  },
  "timestamp": number
}
```

#### VERDICT_RETRY (Client → Server)
```typescript
{
  "type": "VERDICT_RETRY",
  "data": {
    "roomId": string,
    "userId": string
  },
  "timestamp": number
}
```

### 重试机制

- 最多重试 3 次（`VERDICT_CONFIG.MAX_RETRIES`）
- 每次失败递增 `room.verdictRetryCount`
- `VERDICT_FAILED` 中 `canRetry` 标志指示是否可继续重试
- 重试时重置 `verdictStatus` 为 `'pending'` 并重新调用编排服务

---

## HTTP 接口

### POST /v1/rooms/:roomId/judgments（直接调用）

**描述**: 直接调用 LLM 生成 AI 判决。在 WebSocket 驱动的流程中，此接口由 VerdictOrchestratorService 内部调用。

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
    "caseNumber": string,
    "responsibility": {
      "player1": number,           // 0-100（归一化后）
      "player2": number,           // 0-100（归一化后）
      "thirdParty": {
        "factors": [{ "name": string, "percentage": number }]
      }
    },
    "radarChart": {
      "player1": IRadarScores,    // 六维中文键
      "player2": IRadarScores
    },
    "verdict": string,            // 大老爷赠言
    "punishmentTask": string      // 惩罚任务
  }
}
```

**错误**:
- `400 INVALID_REQUEST` — 请求参数验证失败
- `502 LLM_CALL_FAILED` — OpenAI API 调用失败

### GET /v1/rooms/:roomId/verdict（回退接口）

**描述**: 获取已缓存的判决结果。当 WebSocket 推送失败时，客户端可通过此接口获取结果。不会触发新的 LLM 调用。

#### 响应

**成功 (200)**: `{ "success": true, "data": IVerdictResult }`

**未就绪 (404)**: `{ "success": false, "error": { "code": "VERDICT_NOT_READY" } }`

---

## 架构

### 数据流（WebSocket 驱动）

```
Chat Room (ASR 累积)
  ↓ SPEECH_TURN_END
controllers/ws-controller.ts
  ↓ 调用 speech-turn-end-handler
services/handlers/speech-turn-end-handler.ts
  ↓ bothFinished?
controllers/ws-controller.ts
  ↓ 广播 CHAT_COMPLETE + 异步触发:
services/core/verdict-orchestrator.service.ts
  ↓ 获取 speechState
services/core/llm-judgement.service.ts
  ↓
clients/openai.client.ts
  ↓ OpenAI Chat Completion API
  ↓ JSON 响应 + 验证 + 归一化
services/core/verdict-mapper.service.ts
  ↓ 中文键→英文键, player→userId 映射, 添加 emoji/战报
  ↓ 缓存到 room.verdictResult
controllers/ws-controller.ts → 广播 VERDICT_RESULT
```

### 涉及文件

| 文件 | 职责 |
|------|------|
| `controllers/ws-controller.ts` | SPEECH_TURN_END/VERDICT_RETRY 消息路由 |
| `services/handlers/speech-turn-end-handler.ts` | 标记发言完成，判断双方是否都结束 |
| `services/handlers/verdict-retry-handler.ts` | 校验重试次数，重置状态 |
| `services/core/verdict-orchestrator.service.ts` | 判决编排（LLM 调用 + 结果转换 + WS 推送） |
| `services/core/verdict-mapper.service.ts` | LLM 原始结果 → 前端格式转换 |
| `services/core/llm-judgement.service.ts` | LLM 业务逻辑编排 |
| `services/handlers/asr-text-handler.ts` | ASR Final 文本累积到 speechState |
| `controllers/verdict-http.controller.ts` | GET verdict 回退接口 |
| `routes/verdict-routes.ts` | 回退路由定义 |
| `routes/llm-judgement.routes.ts` | POST judgments 路由定义 |
| `controllers/llm-judgement.controller.ts` | POST 请求处理、验证 |
| `clients/openai.client.ts` | OpenAI API 调用封装 + 责任归一化 |
| `constants/prompts.ts` | System Prompt 模板 |
| `models/schemas/llm-request.schema.ts` | Zod 验证 Schema |
| `models/schemas/verdict-message.schema.ts` | 判决 WS 消息验证 |
| `types/llm/judgment.ts` | LLM 原始类型定义 |
| `types/websocket/verdict.ts` | 判决 WS 消息类型定义 |
| `models/entities/room.ts` | IRoom 扩展（speechState, verdictStatus 等） |

---

## VerdictMapperService 转换细节

### 维度键映射（中文 → 英文）

| LLM 输出（中文） | 前端（英文） |
|-----------------|------------|
| 嘴硬程度 | `mouthHard` |
| 翻旧账 | `oldAccountDigging` |
| 逻辑滑坡 | `logicFallacy` |
| 撒娇暴击 | `coquettishDamage` |
| 求生欲 | `survivalInstinct` |
| 受害者演技 | `victimActing` |

### 角色映射

| LLM 输出 | 前端 |
|---------|------|
| `player1` | `participants[0].userId` |
| `player2` | `participants[1].userId` |

### 胜负判定

- 责任百分比较低者为胜者（`winnerId`）
- 相同责任百分比时房主胜

### 附加字段生成

- **emoji**: 第三方因素自动分配 emoji（从预设池轮换）
- **punishmentTask**: 拆分为 `{ role, task }` 结构
- **secretReports**: 为每位玩家生成私密战报（最高维度 + 建议）

---

## 责任归一化

`normalizeResponsibility()` 确保 `player1 + player2 + thirdPartySum = 100`：

- 如果总和已为 100，不做调整
- 总和为 0 时，默认各 50%
- 其他情况按比例缩放并四舍五入
- 四舍五入误差修正到最大桶（player1 或 player2）

---

## OpenAI 集成细节

### 配置

| 参数 | 值 | 说明 |
|------|----|----|
| 模型 | `gpt-4o`（可配置） | 通过 `OPENAI_MODEL` 环境变量 |
| Temperature | `0.7` | 保证创意性 |
| 超时 | `30000ms` | `VERDICT_CONFIG.LLM_TIMEOUT_MS` |
| 响应格式 | JSON | 强制 JSON 输出 |

### 日志

HTTP 接口在 LLM 调用前后记录结构化日志，包含 `durationMs`：

```typescript
// LLM 调用开始
logger.info('llm.judgment.start', { roomId });

// LLM 调用成功（含耗时）
logger.info('llm.judgment.ok', { roomId, durationMs });

// LLM 调用失败（含耗时和错误信息）
logger.error('llm.judgment.failed', { roomId, durationMs, error });
```

WebSocket 流程由 `verdict-orchestrator.service.ts` 记录：

```typescript
// 判决广播成功
logger.info('ws.verdict_result', { roomId, caseNumber });

// 判决生成失败
logger.error('ws.verdict_failed', { roomId, retryCount, error });
```

### 环境变量

```bash
OPENAI_API_KEY=sk-...              # 必需
OPENAI_MODEL=gpt-4o               # 可选，默认 gpt-4o
OPENAI_BASE_URL=...               # 可选，自定义端点
```

### Prompt 结构

- **System Prompt**: 定义清汤大老爷角色（半文半白风格）和输出 JSON 格式（位于 `constants/prompts.ts`）
- **User Content**: 包含双方发言文本（`buildJudgmentUserContent()`）

---

## 六维雷达图维度

| 维度 | 英文键 | 说明 |
|------|--------|------|
| 嘴硬程度 | `mouthHard` | 坚持己见、不肯认错的程度 |
| 翻旧账 | `oldAccountDigging` | 提及过往事件的频率和程度 |
| 逻辑滑坡 | `logicFallacy` | 论证跳跃、逻辑不严密的程度 |
| 撒娇暴击 | `coquettishDamage` | 使用撒娇/卖萌来影响对方的能力 |
| 求生欲 | `survivalInstinct` | 意识到危险并试图挽回的能力 |
| 受害者演技 | `victimActing` | 扮演受害者角色的演技水平 |

每个维度评分范围: 0-100

---

## 配置常量

| 常量 | 值 | 说明 |
|------|----|----|
| `VERDICT_CONFIG.LLM_TIMEOUT_MS` | 30000 | LLM 调用超时 |
| `VERDICT_CONFIG.MAX_RETRIES` | 3 | 最大重试次数 |
| `OPENAI_CONFIG.API_KEY` | (env) | OpenAI API 密钥 |
| `OPENAI_CONFIG.MODEL` | gpt-4o | LLM 模型 |
| `OPENAI_CONFIG.BASE_URL` | (env) | 自定义端点 |

---

## 错误处理

### HTTP 错误

| 场景 | 错误码 | HTTP 状态码 |
|------|--------|-----------|
| 请求参数无效 | `INVALID_REQUEST` | 400 |
| OpenAI API 调用失败 | `LLM_CALL_FAILED` | 502 |
| JSON 解析失败 | `LLM_CALL_FAILED` | 502 |
| 请求超时（>30s） | `LLM_CALL_FAILED` | 502 |

### WebSocket 错误

| 场景 | 处理方式 |
|------|---------|
| LLM 调用失败 | 广播 `VERDICT_FAILED`，含 `canRetry` 标志 |
| 超过重试次数 | `canRetry: false`，客户端显示失败 |
| 空发言文本 | 使用 `"（无发言）"` 替代 |
| 房间不存在 | 返回 ERROR 消息 |

---

## 示例

### HTTP 直接调用

**请求**:
```bash
curl -X POST http://localhost:8080/v1/rooms/room_123456/judgments \
  -H "Content-Type: application/json" \
  -d '{
    "player1Speech": "你总是不听我说话，每次都自己做决定！",
    "player2Speech": "我哪有，你才是每次都不考虑我的感受！"
  }'
```

**响应**:
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
    "verdict": "本官判定双方各打五十大板，建议下次吵架前先喝杯奶茶冷静一下。",
    "punishmentTask": "败方需连续三天早起给对方买早餐"
  }
}
```

### WebSocket VERDICT_RESULT 推送

```json
{
  "type": "VERDICT_RESULT",
  "data": {
    "roomId": "room_123456",
    "verdict": {
      "caseNumber": "NO.23456",
      "winnerId": "user-u1",
      "loserId": "user-u2",
      "participants": [
        { "userId": "user-u1", "nickname": "小明" },
        { "userId": "user-u2", "nickname": "小红" }
      ],
      "responsibility": {
        "players": [
          { "userId": "user-u1", "nickname": "小明", "percentage": 40 },
          { "userId": "user-u2", "nickname": "小红", "percentage": 45 }
        ],
        "thirdParty": [
          { "reason": "水星逆行", "percentage": 10, "emoji": "🪐" },
          { "reason": "空调温度分歧", "percentage": 5, "emoji": "❄️" }
        ]
      },
      "radarChart": [
        {
          "userId": "user-u1",
          "nickname": "小明",
          "scores": {
            "mouthHard": 75,
            "oldAccountDigging": 60,
            "logicFallacy": 40,
            "coquettishDamage": 30,
            "survivalInstinct": 85,
            "victimActing": 50
          }
        },
        {
          "userId": "user-u2",
          "nickname": "小红",
          "scores": {
            "mouthHard": 65,
            "oldAccountDigging": 80,
            "logicFallacy": 55,
            "coquettishDamage": 70,
            "survivalInstinct": 40,
            "victimActing": 60
          }
        }
      ],
      "verdict": "本官判定双方各打五十大板，建议下次吵架前先喝杯奶茶冷静一下。",
      "punishmentTask": {
        "loserUserId": "user-u2",
        "loserNickname": "小红",
        "task": "败方需连续三天早起给对方买早餐",
        "deadline": "须在24小时内完成"
      },
      "secretReports": [
        {
          "userId": "user-u1",
          "title": "求生欲大师",
          "advice": "求生欲满分，但建议少用苦肉计"
        },
        {
          "userId": "user-u2",
          "title": "翻旧账冠军",
          "advice": "翻旧账技能点满，建议把精力放在未来"
        }
      ]
    }
  },
  "timestamp": 1737849900000
}
```

---

## 相关文档

- [API 规格说明](../api-specification.md)
- [数据模型](../data-models.md)
- [产品需求](../product-requirements.md)
