# 工具系统设计

## 概述

mini-cc 提供 5 个内置工具，使用 LangChain 的 `tool()` 函数 + Zod schema 定义。工具通过 `createReactAgent` 自动集成到 Agent 中，由模型原生 tool calling 能力驱动调用。

## 工具定义方式

每个工具使用 `@langchain/core/tools` 的 `tool()` 函数包装：

```typescript
import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const myTool = tool(
  async ({ param1, param2 }) => {
    // 工具逻辑
    return "结果";
  },
  {
    name: "my_tool",
    description: "工具描述（会自动注入到模型的工具定义中）",
    schema: z.object({
      param1: z.string().describe("参数描述"),
      param2: z.string().optional().describe("可选参数描述"),
    }),
  }
);
```

### 与旧接口的区别

| 方面 | 旧方式（自建 Tool 接口） | 新方式（LangChain tool()） |
|------|------------------------|--------------------------|
| 参数定义 | `ToolParameter[]` 数组 | Zod schema |
| 参数类型 | 全部 `string` | 支持多种类型 |
| 执行函数 | `execute(args: Record<string, string>)` | 解构参数 `({ path, content })` |
| 错误处理 | 可能 throw | return 错误信息（不 throw） |
| 工具描述注入 | 手动拼接到系统提示词 | LangChain 自动处理 |

## 工具列表

### 1. read_file (`src/tools/readFile.ts`)

读取指定路径的文件内容。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| path | string | 是 | 文件路径（相对于 cwd） |

**安全限制**：
- 文件大小不超过 100KB
- 超过限制返回错误提示

### 2. write_file (`src/tools/writeFile.ts`)

将内容写入指定路径的文件，自动创建不存在的目录。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| path | string | 是 | 文件路径（相对于 cwd） |
| content | string | 是 | 文件内容 |

**安全限制**：
- 路径必须位于当前工作目录（cwd）之内
- 通过 `path.resolve` + `startsWith` 校验防止路径穿越

### 3. list_files (`src/tools/listFiles.ts`)

列出匹配 glob 模式的文件。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| pattern | string | 否 | glob 模式，默认 `*` |

**默认排除**：`node_modules/**`、`.git/**`、`dist/**`

### 4. search_code (`src/tools/searchCode.ts`)

在代码文件中搜索匹配的文本或正则表达式。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| pattern | string | 是 | 搜索文本或正则 |
| path | string | 否 | 搜索目录，默认 `.` |

**限制**：
- 结果最多显示 50 条
- 搜索超时 10 秒
- 支持的文件类型：`.ts` `.js` `.json` `.md` `.tsx` `.jsx` `.py` `.go` `.rs`

### 5. run_command (`src/tools/runCommand.ts`)

执行 shell 命令并返回输出。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| command | string | 是 | shell 命令 |

**限制**：
- 执行超时 30 秒
- 输出最大 1MB buffer
- 超过 10000 字符的输出会被截断

## 工具导出 (`src/tools/index.ts`)

简化为直接导出 LangChain tools 数组：

```typescript
export const tools = [
  readFileTool,
  writeFileTool,
  listFilesTool,
  searchCodeTool,
  runCommandTool,
];
```

该数组直接传入 `createReactAgent` 的 `tools` 参数。

## 添加新工具

1. 在 `src/tools/` 下创建新文件（如 `myTool.ts`）
2. 使用 `tool()` + Zod schema 定义工具并导出
3. 在 `src/tools/index.ts` 中导入并添加到 `tools` 数组

工具描述和参数 schema 会**由 LangChain 自动转换为模型的工具定义**，无需手动维护提示词。
