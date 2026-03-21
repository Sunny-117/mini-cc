# Mini Claude Code（基于本地 Ollama）设计文档（TypeScript / Node.js 版本）

## 1. 项目目标

实现一个“类 Claude Code”的本地代码助手（Mini CC），具备：

* 基于本地 LLM（Ollama）进行代码理解与生成
* 多文件上下文分析
* CLI 交互体验
* 代码问答 / 修改 / 生成
* 工具调用（读写文件、执行命令）

✅ 使用 **TypeScript + Node.js + 成熟第三方库**

---

## 2. 系统整体架构

```
CLI（Commander）
   ↓
Agent（LangChain JS）
   ↓
Tools（文件 / Shell 工具）
   ↓
Retriever（向量检索）
   ↓
Ollama（本地模型）
```

---

## 3. 技术选型（Node.js 生态）

### 3.1 Agent 框架

✅ **LangChain JS（核心）**

安装：

```bash
pnpm install langchain @langchain/community
```

能力：

* ReAct Agent
* Tool Calling
* 支持 Ollama

---

### 3.2 Ollama 接入

```bash
pnpm install ollama
```

或使用 fetch 调用：

```ts
POST http://localhost:11434/api/generate
```

推荐模型：

* deepseek-coder
* codellama

---

### 3.3 向量检索（RAG）

推荐：

```bash
pnpm install faiss-node
# 或
pnpm install chromadb
```

Embedding：

```bash
pnpm install @xenova/transformers
```

或使用：

* Ollama embeddings

---

### 3.4 CLI

```bash
pnpm install commander chalk ora
```

* commander：命令解析
* chalk：颜色
* ora：loading

---

## 4. 核心模块设计

### 4.1 Agent Core

使用 LangChain：

```ts
import { initializeAgentExecutorWithOptions } from "langchain/agents";
```

模式：

* ReAct

---

### 4.2 Tool System（关键）

使用 LangChain Tool：

```ts
import { DynamicTool } from "langchain/tools";
```

#### 必备工具

1. read_file
2. write_file
3. list_files
4. search_code
5. run_command

示例：

```ts
const readFileTool = new DynamicTool({
  name: "read_file",
  description: "Read file content",
  func: async (path: string) => {
    return await fs.readFile(path, "utf-8");
  },
});
```

---

### 4.3 Context + RAG

流程：

1. 扫描代码库
2. 切分文件（chunk）
3. embedding
4. 存入 FAISS
5. 查询 Top-K

chunk 建议：

* 300~800 tokens

---

### 4.4 CLI

示例：

```ts
program
  .command("ask <query>")
  .action(async (query) => {
    await agent.run(query);
  });
```

---

## 5. Prompt 设计

```text
You are a coding agent.
You MUST use tools when accessing files.
Never fabricate file content.
```

---

## 6. MVP 实现路径（强烈建议按顺序）

### 阶段 1（最小闭环）

* CLI
* Ollama 调用
* read_file / write_file 工具
* Agent 串起来

👉 目标：能修改一个文件

---

### 阶段 2

* 加入 FAISS
* 支持代码问答

---

### 阶段 3

* 多文件修改
* Plan + Execute

---

## 7. 项目目录结构

```
mini-cc/
 ├── src/
 │   ├── agent/
 │   ├── tools/
 │   ├── retriever/
 │   ├── cli/
 │   ├── llm/
 │   └── index.ts
 ├── package.json
 └── tsconfig.json
```

---

## 8. 关键设计原则

### ✅ 不造轮子

直接用：

* LangChain（Agent + Tool）
* FAISS / Chroma（检索）

---

### ✅ 控制复杂度

第一版不要做：

* GUI
* 多 Agent
* 自动 PR

---

## 9. 难点

1. Tool 调用稳定性
2. Prompt 约束
3. 上下文长度控制

---

## 10. 一句话架构

“LangChain JS + Ollama + 本地工具 + 向量检索”

---

## 11. Claude Code 实现提示（直接可用）

实现顺序：

1. 初始化 Node 项目（TS）
2. 接入 Ollama
3. 实现 read/write 工具
4. 初始化 LangChain Agent
5. 打通 CLI → Agent → Tool → LLM
6. 加入向量检索

---




 Plan to implement                                                                               │
│                                                                                                 │
│ Mini Claude Code (mini-cc) Implementation Plan                                                  │
│                                                                                                 │
│ Context                                                                                         │
│                                                                                                 │
│ 基于 docs.md 实现 Phase 1 MVP：一个本地代码助手 CLI，使用 Ollama (deepseek-r1) 作为             │
│ LLM，支持文件读写、命令执行等工具调用。                                                         │
│                                                                                                 │
│ 关键发现：deepseek-r1 不支持 Ollama 原生 tool calling API，因此不能使用 LangChain 的            │
│ createReactAgent。改为直接使用 ollama npm 包 + 自建 prompt-based ReAct 循环，更简单、依赖更少。 │
│                                                                                                 │
│ Architecture                                                                                    │
│                                                                                                 │
│ CLI (Commander + readline) → Agent (自建 ReAct Loop) → Tools (5个) → Ollama Client →            │
│ deepseek-r1                                                                                     │
│                                                                                                 │
│ File Structure (11 files)                                                                       │
│                                                                                                 │
│ mini-cc/                                                                                        │
│ ├── src/                                                                                        │
│ │   ├── agent/                                                                                  │
│ │   │   ├── agent.ts        # 核心 ReAct 循环                                                   │
│ │   │   ├── parser.ts       # 解析模型输出中的 <tool_call> 标签                                 │
│ │   │   └── prompt.ts       # 系统提示词（自动生成工具描述）                                    │
│ │   ├── tools/                                                                                  │
│ │   │   ├── types.ts        # Tool 接口定义                                                     │
│ │   │   ├── readFile.ts     # read_file                                                         │
│ │   │   ├── writeFile.ts    # write_file                                                        │
│ │   │   ├── listFiles.ts    # list_files                                                        │
│ │   │   ├── searchCode.ts   # search_code                                                       │
│ │   │   ├── runCommand.ts   # run_command                                                       │
│ │   │   └── index.ts        # 工具注册表                                                        │
│ │   ├── llm/                                                                                    │
│ │   │   └── ollama.ts       # Ollama 客户端（支持流式）                                         │
│ │   ├── cli/                                                                                    │
│ │   │   └── index.ts        # Commander 命令 + 交互式 chat loop                                 │
│ │   └── index.ts            # 入口                                                              │
│ ├── package.json                                                                                │
│ └── tsconfig.json                                                                               │
│                                                                                                 │
│ Dependencies                                                                                    │
│                                                                                                 │
│ 运行依赖: ollama, commander, chalk, ora, glob                                                   │
│ 开发依赖: typescript, tsx, @types/node                                                          │
│                                                                                                 │
│ 不使用 LangChain（deepseek-r1 无法使用其核心 Agent 能力，引入只增加包体积）。                   │
│                                                                                                 │
│ Implementation Steps                                                                            │
│                                                                                                 │
│ Step 1: 项目初始化                                                                              │
│                                                                                                 │
│ - 创建 package.json（type: module, ESM）、tsconfig.json                                         │
│ - pnpm install 安装依赖                                                                         │
│                                                                                                 │
│ Step 2: Ollama 客户端 (src/llm/ollama.ts)                                                       │
│                                                                                                 │
│ - 封装 chat() 和 chatStream() 函数                                                              │
│ - 支持通过 MINI_CC_MODEL 环境变量切换模型                                                       │
│ - 处理连接错误（Ollama 未启动时给出提示）                                                       │
│                                                                                                 │
│ Step 3: 工具系统 (src/tools/)                                                                   │
│                                                                                                 │
│ - 定义 Tool 接口：name, description, parameters, execute                                        │
│ - 实现 5 个工具：                                                                               │
│   - read_file: 读文件，限制 100KB                                                               │
│   - write_file: 写文件，路径安全校验（不可写 cwd 之外）                                         │
│   - list_files: glob 匹配，排除 node_modules/.git                                               │
│   - search_code: grep 搜索，限制 50 条结果                                                      │
│   - run_command: 执行 shell 命令，30s 超时                                                      │
│ - index.ts 导出工具数组和 Map                                                                   │
│                                                                                                 │
│ Step 4: Agent 核心 (src/agent/)                                                                 │
│                                                                                                 │
│ - prompt.ts: 从 Tool[] 自动生成系统提示词，指定 <tool_call> XML 格式                            │
│ - parser.ts: 解析模型输出                                                                       │
│   - 剥离 <think> 标签（deepseek-r1 思维链）                                                     │
│   - 提取 <tool_call><name>...</name><args>...</args></tool_call>                                │
│   - 处理 JSON 解析失败、格式错误等边界情况                                                      │
│ - agent.ts: ReAct 循环                                                                          │
│   - 最多 15 轮迭代防止无限循环                                                                  │
│   - 工具结果以 <tool_result> 格式注入为 user 消息                                               │
│   - 通过回调通知 CLI 当前状态（thinking/tool_call/response）                                    │
│                                                                                                 │
│ Step 5: CLI (src/cli/index.ts + src/index.ts)                                                   │
│                                                                                                 │
│ - Commander 定义 chat（交互模式）和 ask（单次提问）命令                                         │
│ - 默认进入 chat 模式                                                                            │
│ - readline 交互循环，支持 /exit、/clear 命令                                                    │
│ - ora spinner 显示进度，chalk 彩色输出                                                          │
│ - 工具调用过程可视化（显示调用了什么工具）                                                      │
│                                                                                                 │
│ Verification                                                                                    │
│                                                                                                 │
│ # 1. 编译检查                                                                                   │
│ pnpm build                                                                                      │
│                                                                                                 │
│ # 2. 开发模式运行                                                                               │
│ pnpm dev                                                                                        │
│                                                                                                 │
│ # 3. 测试交互                                                                                   │
│ > 列出当前目录的文件                                                                            │
│ > 读取 package.json 的内容                                                                      │
│ > 创建一个 hello.ts 文件，内容是 console.log("hello")


Plan to implement                                                                               │
│                                                                                                 │
│ 集成 LangChain.js 替换自建 ReAct 循环                                                           │
│                                                                                                 │
│ Context                                                                                         │
│                                                                                                 │
│ 当前 mini-cc 使用自建的 prompt-based ReAct 循环 + XML                                           │
│ 解析来实现工具调用。这种方式存在诸多不足：模型经常漏写 <tool_call> 标签、JSON                   │
│ 参数转义困难、HTML 等复杂内容写入不可靠。                                                       │
│                                                                                                 │
│ 目标：集成 LangChain.js，使用 createReactAgent 替换自建 ReAct 循环，利用模型原生 tool calling   │
│ 能力，从根本上解决工具调用的可靠性问题。                                                        │
│                                                                                                 │
│ 关键变化：默认模型从 deepseek-r1（不支持原生 tool calling）切换为 qwen2.5（支持原生 tool        │
│ calling）。                                                                                     │
│                                                                                                 │
│ Architecture                                                                                    │
│                                                                                                 │
│ CLI (Commander + readline)                                                                      │
│   → createReactAgent (LangGraph)                                                                │
│     → ChatOllama (LangChain)                                                                    │
│       → qwen2.5 (Ollama, 原生 tool calling)                                                     │
│     → LangChain Tools (zod schema)                                                              │
│                                                                                                 │
│ Dependencies 变更                                                                               │
│                                                                                                 │
│ 新增: @langchain/core, @langchain/ollama, @langchain/langgraph, zod                             │
│ 移除: ollama (由 @langchain/ollama 内部依赖)                                                    │
│ 保留: commander, chalk, ora, glob                                                               │
│                                                                                                 │
│ File Changes                                                                                    │
│                                                                                                 │
│ 删除 (3 files) — 自建 ReAct 相关，LangChain 不再需要                                            │
│                                                                                                 │
│ - src/tools/types.ts — 自定义 Tool 接口，被 LangChain tool() 替代                               │
│ - src/agent/parser.ts — XML 解析器，原生 tool calling 不需要                                    │
│ - src/agent/prompt.ts — 手动构建 system prompt，LangChain 自动处理工具描述                      │
│                                                                                                 │
│ 重写 (8 files)                                                                                  │
│                                                                                                 │
│ src/llm/ollama.ts — 改用 ChatOllama                                                             │
│ import { ChatOllama } from "@langchain/ollama";                                                 │
│ // 导出 createLLM() 和 getModel()                                                               │
│ // 默认模型改为 qwen2.5                                                                         │
│ // 保留 MINI_CC_MODEL / OLLAMA_HOST 环境变量                                                    │
│                                                                                                 │
│ src/tools/*.ts (5 个工具文件) — 改用 LangChain tool() + zod schema                              │
│ import { tool } from "@langchain/core/tools";                                                   │
│ import { z } from "zod";                                                                        │
│ // 工具逻辑不变，只是包装方式改变                                                               │
│ // execute(args: Record<string,string>) → tool(async ({path, content}) => ...)                  │
│ // 错误用 return 返回（不 throw），让 agent 可以推理                                            │
│                                                                                                 │
│ src/tools/index.ts — 简化为导出 LangChain tools 数组                                            │
│ export const tools = [readFile, writeFile, listFiles, searchCode, runCommand];                  │
│                                                                                                 │
│ src/agent/agent.ts — 核心重写                                                                   │
│ import { createReactAgent } from "@langchain/langgraph/prebuilt";                               │
│ import { MemorySaver } from "@langchain/langgraph";                                             │
│ // createReactAgent({ llm, tools, prompt, checkpointer })                                       │
│ // 用 MemorySaver + threadId 管理对话历史（不再手动传 history）                                 │
│ // stream({ messages }, { configurable: { thread_id } })  获取流式事件                          │
│ // 回调接口保持不变 (AgentCallback)                                                             │
│                                                                                                 │
│ src/cli/index.ts — 适配新 agent 接口                                                            │
│ // history: Message[] → threadId: string (UUID)                                                 │
│ // /clear → 重新生成 threadId                                                                   │
│ // runAgent(msg, history, cb) → runAgent(msg, threadId, cb)                                     │
│                                                                                                 │
│ Implementation Steps                                                                            │
│                                                                                                 │
│ Step 1: 更新依赖                                                                                │
│                                                                                                 │
│ - 移除 ollama，添加 @langchain/core, @langchain/ollama, @langchain/langgraph, zod               │
│ - pnpm install                                                                                  │
│                                                                                                 │
│ Step 2: 重写工具 (src/tools/)                                                                   │
│                                                                                                 │
│ - 删除 types.ts                                                                                 │
│ - 重写 5 个工具文件为 LangChain tool() 格式                                                     │
│ - 更新 index.ts 导出                                                                            │
│                                                                                                 │
│ Step 3: 重写 LLM 层 (src/llm/ollama.ts)                                                         │
│                                                                                                 │
│ - 改用 ChatOllama，默认模型 qwen2.5                                                             │
│                                                                                                 │
│ Step 4: 重写 Agent (src/agent/)                                                                 │
│                                                                                                 │
│ - 删除 parser.ts、prompt.ts                                                                     │
│ - 重写 agent.ts，使用 createReactAgent + MemorySaver                                            │
│ - 保持 AgentCallback 接口不变                                                                   │
│                                                                                                 │
│ Step 5: 更新 CLI (src/cli/index.ts)                                                             │
│                                                                                                 │
│ - 对话历史改为 threadId 管理                                                                    │
│ - /clear 生成新 threadId                                                                        │
│                                                                                                 │
│ Step 6: 构建验证                                                                                │
│                                                                                                 │
│ - pnpm build 编译通过                                                                           │
│ - 测试基础对话、工具调用、文件写入                                                              │
│                                                                                                 │
│ Verification                                                                                    │
│                                                                                                 │
│ # 确保 qwen2.5 已拉取                                                                           │
│ ollama pull qwen2.5                                                                             │
│                                                                                                 │
│ # 编译                                                                                          │
│ pnpm build                                                                                      │
│                                                                                                 │
│ # 运行测试                                                                                      │
│ pnpm dev                                                                                        │
│ > 你好                                                                                          │
│ > 列出当前目录的文件                                                                            │
│ > 读取 package.json 的内容                                                                      │
│ > 创建一个包含标题和按钮的 index.html 页面