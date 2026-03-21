# Mini Claude Code (mini-cc) 架构设计

## 整体架构

```
用户输入 (CLI)
   ↓
Commander 命令解析
   ↓
Agent ReAct 循环 (自建，非 LangChain)
   ↓  ↑
   ↓  ↑ <tool_call> / <tool_result> XML 交互
   ↓  ↑
Ollama 客户端 (ollama npm 包)
   ↓
deepseek-r1 (本地模型)
```

## 为什么不用 LangChain

原始设计文档（`docs.md`）计划使用 LangChain JS 的 `createReactAgent`。但经过调研发现：

1. **deepseek-r1 不支持 Ollama 原生 tool calling API** — LangChain 的 `createReactAgent` 依赖模型原生的 tool calling 能力，deepseek-r1 不具备该能力
2. **引入 LangChain 只增加包体积** — 无法使用其核心 Agent 功能，得不偿失
3. **自建 ReAct 循环更简单可控** — 直接使用 `ollama` npm 包 + prompt-based XML 工具调用格式

## 数据流

```
1. 用户输入 → CLI (readline)
2. CLI → Agent.runAgent(userMessage, history, callback)
3. Agent 构建 messages: [system prompt, ...history, user message]
4. Agent 发送 messages → Ollama chat API
5. Ollama 返回模型输出 (可能包含 <think> 和 <tool_call>)
6. Parser 解析输出:
   - 剥离 <think> 标签 (deepseek-r1 思维链)
   - 提取 <tool_call> (如果有)
7a. 有工具调用 → 执行工具 → 结果以 <tool_result> 注入 → 回到步骤 4
7b. 无工具调用 → 返回最终文本给 CLI
8. CLI 展示结果，等待下一轮输入
```

## 模块依赖关系

```
src/index.ts
  └── src/cli/index.ts
        ├── src/agent/agent.ts
        │     ├── src/agent/prompt.ts
        │     │     └── src/tools/types.ts
        │     ├── src/agent/parser.ts
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
| Agent 框架 | 自建 ReAct 循环 | deepseek-r1 不支持原生 tool calling |
| 工具调用格式 | XML (`<tool_call>`) | 对 LLM 友好，解析简单 |
| LLM 客户端 | `ollama` npm 包 | 官方包，API 简单 |
| 模块系统 | ESM (type: module) | 现代标准，chalk/ora 仅支持 ESM |
| 迭代限制 | 15 轮 | 防止无限循环消耗资源 |
| 思维链处理 | 剥离 `<think>` 标签 | deepseek-r1 特有，不展示给用户 |
