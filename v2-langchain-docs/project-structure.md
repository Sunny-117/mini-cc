# 项目结构说明

## 目录结构

```
mini-cc/
├── src/                        # 源码目录
│   ├── index.ts                # 入口文件（shebang, 解析命令）
│   ├── cli/
│   │   └── index.ts            # CLI 交互（Commander + readline）
│   ├── agent/
│   │   └── agent.ts            # LangGraph ReAct Agent（createReactAgent）
│   ├── tools/
│   │   ├── readFile.ts         # read_file 工具
│   │   ├── writeFile.ts        # write_file 工具
│   │   ├── listFiles.ts        # list_files 工具
│   │   ├── searchCode.ts       # search_code 工具
│   │   ├── runCommand.ts       # run_command 工具
│   │   └── index.ts            # 工具导出
│   └── llm/
│       └── ollama.ts           # ChatOllama 封装
├── dist/                       # 编译输出（tsc 生成）
├── docs/                       # 项目文档
│   ├── architecture.md         # 架构设计
│   ├── agent.md                # Agent 核心设计
│   ├── tools.md                # 工具系统设计
│   └── project-structure.md    # 本文件
├── package.json                # 项目配置（ESM, 依赖, 脚本）
├── tsconfig.json               # TypeScript 配置
└── docs.md                     # 原始设计文档
```

## 依赖说明

### 运行依赖

| 包名 | 用途 |
|------|------|
| `@langchain/core` | LangChain 核心（tool 定义、消息类型） |
| `@langchain/ollama` | ChatOllama，与 Ollama 模型通信 |
| `@langchain/langgraph` | LangGraph（createReactAgent、MemorySaver） |
| `zod` | 工具参数 schema 定义 |
| `commander` | CLI 命令解析框架 |
| `chalk` | 终端彩色文本输出 |
| `ora` | 终端加载动画（spinner） |
| `glob` | 文件 glob 模式匹配 |

### 开发依赖

| 包名 | 用途 |
|------|------|
| `typescript` | TypeScript 编译器 |
| `tsx` | TypeScript 直接执行（开发模式） |
| `@types/node` | Node.js 类型定义 |

## TypeScript 配置要点

- **target**: ES2022 — 支持 top-level await 等现代语法
- **module**: Node16 — 对应 ESM + Node.js 解析规则
- **strict**: true — 严格类型检查
- 导入路径使用 `.js` 后缀（Node16 模块解析要求）

## npm 脚本

| 命令 | 说明 |
|------|------|
| `pnpm build` | TypeScript 编译到 `dist/` |
| `pnpm dev` | 使用 tsx 直接运行（开发模式） |
| `pnpm start` | 运行编译后的代码 |
