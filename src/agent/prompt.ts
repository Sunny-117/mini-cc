import type { Tool } from "../tools/types.js";

function formatParameters(tool: Tool): string {
  return tool.parameters
    .map((p) => `    - ${p.name} (${p.type}${p.required ? ", 必填" : ", 可选"}): ${p.description}`)
    .join("\n");
}

function formatExample(tool: Tool): string {
  const params = tool.parameters
    .map((p) => `<${p.name}>${p.name === "content" ? "文件内容直接写在这里..." : `示例${p.description}`}</${p.name}>`)
    .join("\n");
  return `<tool_call>
<name>${tool.name}</name>
${params}
</tool_call>`;
}

export function buildSystemPrompt(tools: Tool[]): string {
  const toolDescriptions = tools
    .map(
      (t) =>
        `- **${t.name}**: ${t.description}\n  参数:\n${formatParameters(t)}`
    )
    .join("\n\n");

  return `你是一个强大的代码助手 Agent。你可以帮助用户编写代码、修改文件、调试问题。你可以使用以下工具来完成任务。

## 可用工具

${toolDescriptions}

## 工具调用格式

当你需要使用工具时，使用以下 XML 格式，每个参数用对应的 XML 标签包裹：

${formatExample(tools[0])}

### write_file 示例（写入代码文件）

<tool_call>
<name>write_file</name>
<path>src/hello.ts</path>
<content>
export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

console.log(greet("World"));
</content>
</tool_call>

**注意**：<content> 标签内直接写入原始代码，不需要 JSON 转义，不需要用反引号包裹。

## 重要规则

1. **必须使用工具**来读取和写入文件，不要猜测或编造文件内容。
2. 每次回复中可以调用**一个**工具。
3. 工具调用后，你会收到 <tool_result> 标签中的执行结果。
4. 根据工具结果继续推理或给出最终回答。
5. 当任务完成后，直接给出最终回答文本，不要再调用工具。
6. 用中文回复用户，除非用户使用其他语言。
7. 当用户要求编写或修改代码时，先用 read_file 读取已有文件（如果存在），再用 write_file 写入完整的新内容。
8. 写入文件时，<content> 内放原始代码内容，不要做任何转义。
`;
}
