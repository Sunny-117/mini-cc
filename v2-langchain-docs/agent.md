# Agent 核心设计

## 概述

Agent 是 mini-cc 的核心模块，基于 LangGraph 的 `createReactAgent` 实现 ReAct（Reasoning + Acting）循环。利用模型原生 tool calling 能力，无需手动解析工具调用。

## 文件组成

```
src/agent/
└── agent.ts    # createReactAgent 封装 + 事件流处理
```

相比之前的自建 ReAct 实现，删除了：
- `parser.ts` — XML 解析器（原生 tool calling 不需要）
- `prompt.ts` — 手动构建系统提示词（LangChain 自动处理工具描述）

## 系统提示词

系统提示词直接作为字符串传入 `createReactAgent` 的 `prompt` 参数，定义了 Agent 的行为规则：

1. 必须通过工具来读取、写入文件
2. 每次回复只调用一个工具
3. 用中文回复用户
4. 执行命令前考虑安全性
5. 工具失败时分析原因并尝试其他方案

工具描述由 LangChain 根据 Zod schema 自动生成并注入，无需手动维护。

## Agent 创建

```typescript
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";

const agent = createReactAgent({
  llm: createLLM(),       // ChatOllama 实例
  tools,                  // LangChain tools 数组
  prompt: SYSTEM_PROMPT,  // 系统提示词字符串
  checkpointer,           // MemorySaver 实例
});
```

`createReactAgent` 自动创建一个 LangGraph 图，包含：
- **agent 节点** — 调用 LLM，决定是否调用工具
- **tools 节点** — 执行工具并返回结果
- 自动循环直到 LLM 不再请求工具调用

## 核心函数

```typescript
async function runAgent(
  userMessage: string,
  threadId: string,        // 用于 MemorySaver 管理对话历史
  callback?: AgentCallback // 状态回调（通知 CLI）
): Promise<string>
```

### 执行流程

```
构建 input = { messages: [HumanMessage(userMessage)] }
│
├─ agent.streamEvents(input, { thread_id })
│   │
│   ├─ on_chat_model_end:
│   │   ├─ 有 tool_calls → 触发 tool_call 回调
│   │   └─ 无 tool_calls → 记录最终回复，触发 response 回调
│   │
│   ├─ on_tool_end:
│   │   └─ 触发 tool_result 回调
│   │
│   └─ 循环直到模型不再调用工具
│
└─ 返回最终回复文本
```

### 回调事件

Agent 通过 `AgentCallback` 通知 CLI 当前状态：

| 事件类型 | 触发时机 | data 内容 |
|----------|----------|-----------|
| `thinking` | 开始处理请求 | 空字符串 |
| `tool_call` | 模型请求调用工具 | JSON 格式的参数 |
| `tool_result` | 工具执行完成 | 执行结果（超过 500 字符截断） |
| `response` | 最终回答 | 回答文本 |
| `error` | 出错 | 错误信息 |

## 对话历史管理

- 使用 LangGraph 的 `MemorySaver` 作为 checkpointer
- 每个对话通过 `threadId`（UUID）标识
- 对话历史自动持久化在内存中，无需手动传递 `Message[]`
- `/clear` 命令生成新的 `threadId`，等效于开启新对话
- 系统提示词通过 `prompt` 参数注入，由 LangGraph 自动管理

## 错误处理

- Ollama 连接失败时，检测 `ECONNREFUSED` 并给出启动 Ollama 的提示
- 工具执行错误由各工具内部捕获并返回错误信息（不 throw），让 Agent 可以推理并尝试其他方案
