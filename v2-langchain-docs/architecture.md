# Mini Claude Code (mini-cc) 架构设计

## 整体架构

```
用户输入 (CLI)
   ↓
Commander 命令解析
   ↓
createReactAgent (LangGraph)
   ↓  ↑
   ↓  ↑ 原生 tool calling（模型自动生成工具调用）
   ↓  ↑
ChatOllama (@langchain/ollama)
   ↓
qwen2.5 (Ollama 本地模型，支持原生 tool calling)
```

## 为什么使用 LangChain.js

项目最初使用自建 prompt-based ReAct 循环 + XML 解析来实现工具调用（配合 deepseek-r1 模型）。这种方式存在诸多问题：

1. **XML 解析不可靠** — 模型经常漏写 `<tool_call>` 标签、JSON 参数转义困难
2. **HTML 等复杂内容写入不可靠** — XML 格式与 HTML 内容冲突
3. **解析器复杂** — 需要处理多种格式变体和边界情况

切换到 LangChain.js + 支持原生 tool calling 的模型（qwen2.5）后：

1. **工具调用可靠** — 使用模型原生 tool calling API，不再依赖 XML 解析
2. **代码大幅简化** — 删除了 parser.ts、prompt.ts、types.ts，Agent 核心逻辑更清晰
3. **对话历史自动管理** — LangGraph 的 MemorySaver 自动管理，不再手动传递 `Message[]`
4. **工具定义标准化** — Zod schema 定义参数，类型安全

## 数据流

```
1. 用户输入 → CLI (readline)
2. CLI → runAgent(userMessage, threadId, callback)
3. Agent 发送 HumanMessage → createReactAgent
4. LangGraph 自动编排:
   - 调用 ChatOllama 获取模型响应
   - 模型通过原生 tool calling 返回工具调用请求
   - LangGraph 自动执行工具（ToolNode）
   - 工具结果自动注入回模型
   - 循环直到模型返回最终文本
5. streamEvents 产生实时事件 → AgentCallback 通知 CLI
6. CLI 展示结果，等待下一轮输入
```

## 模块依赖关系

```
src/index.ts
  └── src/cli/index.ts
        ├── src/agent/agent.ts
        │     ├── src/tools/index.ts
        │     │     ├── src/tools/readFile.ts
        │     │     ├── src/tools/writeFile.ts
        │     │     ├── src/tools/listFiles.ts
        │     │     ├── src/tools/searchCode.ts
        │     │     └── src/tools/runCommand.ts
        │     └── src/llm/ollama.ts
        └── src/llm/ollama.ts
```

## 关键设计决策

| 决策 | 选择 | 原因 |
|------|------|------|
| Agent 框架 | LangGraph `createReactAgent` | 利用模型原生 tool calling，可靠性高 |
| 工具调用格式 | 模型原生 tool calling | 不再需要 XML 解析，消除格式错误 |
| LLM 客户端 | `@langchain/ollama` (ChatOllama) | 与 LangChain 生态集成 |
| 默认模型 | `qwen2.5` | 支持原生 tool calling，性能好 |
| 工具 schema | Zod | 类型安全，LangChain 标准 |
| 对话历史 | MemorySaver + threadId | 自动管理，无需手动传递 |
| 模块系统 | ESM (type: module) | 现代标准，chalk/ora 仅支持 ESM |
