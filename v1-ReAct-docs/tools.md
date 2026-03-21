# 工具系统设计

## 概述

mini-cc 提供 5 个内置工具，供 Agent 在 ReAct 循环中调用。所有工具实现统一的 `Tool` 接口，通过工具注册表统一管理。

## Tool 接口

```typescript
interface ToolParameter {
  name: string;        // 参数名
  type: string;        // 参数类型 (string)
  description: string; // 参数描述
  required: boolean;   // 是否必填
}

interface Tool {
  name: string;                                           // 工具名称
  description: string;                                    // 工具描述（会注入到系统提示词）
  parameters: ToolParameter[];                            // 参数定义
  execute: (args: Record<string, string>) => Promise<string>; // 执行函数
}
```

接口定义位于 `src/tools/types.ts`。

## 工具列表

### 1. read_file (`src/tools/readFile.ts`)

读取指定路径的文件内容。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| path | string | 是 | 文件路径（相对于 cwd） |

**安全限制**：
- 文件大小不超过 100KB
- 超过限制返回错误提示

**示例调用**：
```xml
<tool_call>
<name>read_file</name>
<args>{"path": "src/index.ts"}</args>
</tool_call>
```

### 2. write_file (`src/tools/writeFile.ts`)

将内容写入指定路径的文件，自动创建不存在的目录。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| path | string | 是 | 文件路径（相对于 cwd） |
| content | string | 是 | 文件内容 |

**安全限制**：
- 路径必须位于当前工作目录（cwd）之内
- 通过 `path.resolve` + `startsWith` 校验防止路径穿越

**示例调用**：
```xml
<tool_call>
<name>write_file</name>
<args>{"path": "hello.ts", "content": "console.log('hello')"}</args>
</tool_call>
```

### 3. list_files (`src/tools/listFiles.ts`)

列出匹配 glob 模式的文件。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| pattern | string | 否 | glob 模式，默认 `*` |

**默认排除**：`node_modules/**`、`.git/**`、`dist/**`

**示例调用**：
```xml
<tool_call>
<name>list_files</name>
<args>{"pattern": "src/**/*.ts"}</args>
</tool_call>
```

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

**示例调用**：
```xml
<tool_call>
<name>search_code</name>
<args>{"pattern": "export function", "path": "src"}</args>
</tool_call>
```

### 5. run_command (`src/tools/runCommand.ts`)

执行 shell 命令并返回输出。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| command | string | 是 | shell 命令 |

**限制**：
- 执行超时 30 秒
- 输出最大 1MB buffer
- 超过 10000 字符的输出会被截断

**示例调用**：
```xml
<tool_call>
<name>run_command</name>
<args>{"command": "ls -la"}</args>
</tool_call>
```

## 工具注册表 (`src/tools/index.ts`)

提供两种访问方式：

```typescript
// 数组形式（用于生成系统提示词）
export const tools: Tool[] = [readFileTool, writeFileTool, ...];

// Map 形式（用于按名称查找执行）
export const toolMap = new Map<string, Tool>(...);
```

## 添加新工具

1. 在 `src/tools/` 下创建新文件（如 `myTool.ts`）
2. 实现 `Tool` 接口并导出
3. 在 `src/tools/index.ts` 中导入并添加到 `tools` 数组

工具描述和参数会**自动注入到系统提示词**中，无需手动修改 prompt。
