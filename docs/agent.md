# Agent 核心设计

## 概述

Agent 是 mini-cc 的核心模块，实现了 prompt-based 的 ReAct（Reasoning + Acting）循环。由于 deepseek-r1 不支持 Ollama 原生 tool calling API，我们采用 XML 格式的工具调用方案。

## 文件组成

```
src/agent/
├── prompt.ts   # 系统提示词生成
├── parser.ts   # 模型输出解析
└── agent.ts    # ReAct 循环主逻辑
```

## 系统提示词 (`prompt.ts`)

`buildSystemPrompt(tools: Tool[])` 函数从工具定义自动生成系统提示词，包括：

1. **角色设定** — 代码助手 Agent
2. **工具列表** — 从 `Tool[]` 自动生成名称、描述、参数说明
3. **调用格式** — 指定 XML 格式规范
4. **行为规则** — 必须使用工具读取文件、每次只调用一个工具等

生成的提示词示例片段：

```
## 可用工具

- **read_file**: 读取指定路径的文件内容。路径相对于当前工作目录。
  参数:
    - path (string, 必填): 要读取的文件路径

## 工具调用格式

<tool_call>
<name>工具名称</name>
<args>
{
  "参数名": "参数值"
}
</args>
</tool_call>
```

## 输出解析 (`parser.ts`)

`parseModelOutput(content: string)` 处理模型原始输出，返回：

```typescript
interface ParseResult {
  thinking: string;            // <think> 标签中的思维链内容
  text: string;                // 工具调用之外的文本
  toolCall: ParsedToolCall | null; // 解析出的工具调用（如果有）
}
```

### 解析步骤

1. **剥离思维链** — 移除所有 `<think>...</think>` 标签（deepseek-r1 特有），提取思维内容但不展示
2. **提取工具调用** — 用正则匹配 `<tool_call><name>...</name><args>...</args></tool_call>`
3. **解析参数 JSON** — 先尝试 `JSON.parse`，失败则尝试宽松的 key-value 解析

### 边界情况处理

- 模型未输出工具调用 → `toolCall: null`，视为最终回答
- JSON 解析失败 → 尝试宽松解析（`key: value` 格式）
- 宽松解析也失败 → `toolCall: null`，将原始文本作为回答

## ReAct 循环 (`agent.ts`)

`runAgent()` 是核心执行函数：

```typescript
async function runAgent(
  userMessage: string,
  history: Message[],      // 对话历史
  callback?: AgentCallback // 状态回调（通知 CLI）
): Promise<{ response: string; history: Message[] }>
```

### 循环流程

```
构建 messages = [system, ...history, user]
│
├─ for (i = 0; i < 15; i++)
│   │
│   ├─ 调用 Ollama chat(messages)
│   ├─ 解析模型输出 (parser)
│   │
│   ├─ 无工具调用?
│   │   └─ 返回最终文本 ✅
│   │
│   ├─ 有工具调用:
│   │   ├─ 查找工具 (toolMap)
│   │   ├─ 执行工具 (tool.execute)
│   │   ├─ 将助手原始输出 push 到 messages (role: assistant)
│   │   └─ 将 <tool_result> push 到 messages (role: user)
│   │
│   └─ 继续循环 →
│
└─ 超过 15 轮 → 返回错误提示
```

### 回调事件

Agent 通过 `AgentCallback` 通知 CLI 当前状态：

| 事件类型 | 触发时机 | data 内容 |
|----------|----------|-----------|
| `thinking` | 模型输出包含 `<think>` | 思维链文本 |
| `tool_call` | 解析到工具调用 | JSON 格式的参数 |
| `tool_result` | 工具执行完成 | 执行结果（超过 500 字符截断） |
| `response` | 最终回答 | 回答文本 |
| `error` | 出错或超过迭代限制 | 错误信息 |

### 消息格式约定

**模型输出工具调用时**：

```
我需要读取文件内容来了解项目结构。

<tool_call>
<name>read_file</name>
<args>{"path": "package.json"}</args>
</tool_call>
```

**工具结果注入格式（作为 user 消息）**：

```
<tool_result>
{
  "name": "mini-cc",
  "version": "0.1.0",
  ...
}
</tool_result>
```

## 对话历史管理

- 对话历史由 CLI 层持有，每轮调用传入 `history` 参数
- Agent 返回更新后的 `history`（追加了当前轮的 user + assistant 消息）
- `/clear` 命令清空历史
- 系统提示词不存入历史，每次调用重新构建
