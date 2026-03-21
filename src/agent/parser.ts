import { tools } from "../tools/index.js";

export interface ParsedToolCall {
  name: string;
  args: Record<string, string>;
}

export interface ParseResult {
  thinking: string;
  text: string;
  toolCall: ParsedToolCall | null;
}

/** 所有已注册的工具名，用于兜底识别 */
const toolNames = new Set(tools.map((t) => t.name));

/**
 * 剥离 <think>...</think> 标签内容
 */
function stripThinking(content: string): { thinking: string; rest: string } {
  const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
  let thinking = "";
  let match;
  while ((match = thinkRegex.exec(content)) !== null) {
    thinking += match[1].trim() + "\n";
  }
  const rest = content.replace(thinkRegex, "").trim();
  return { thinking: thinking.trim(), rest };
}

/**
 * 从一段 XML 片段中按子标签提取参数
 * 跳过 <name> 标签（那是工具名）
 */
function parseXmlParams(body: string): Record<string, string> {
  const args: Record<string, string> = {};
  const paramRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
  let m;
  while ((m = paramRegex.exec(body)) !== null) {
    const tag = m[1];
    if (tag === "name" || tag === "args" || tag === "tool_call") continue;
    let value = m[2];
    if (value.startsWith("\n")) value = value.slice(1);
    if (value.endsWith("\n")) value = value.slice(0, -1);
    args[tag] = value;
  }
  return args;
}

/**
 * 尝试从 <args>...</args> 中解析 JSON 或宽松 key-value
 */
function parseJsonArgs(body: string): Record<string, string> {
  const argsMatch = /<args>([\s\S]*?)<\/args>/.exec(body);
  if (!argsMatch) return {};

  const argsStr = argsMatch[1].trim();
  try {
    return JSON.parse(argsStr);
  } catch {
    const args: Record<string, string> = {};
    for (const line of argsStr.split("\n")) {
      const kv = line.match(/^\s*"?(\w+)"?\s*[:=]\s*"?(.*?)"?\s*,?\s*$/);
      if (kv) args[kv[1]] = kv[2];
    }
    return args;
  }
}

/**
 * 提取工具调用，支持三种模型输出格式：
 *
 * 格式 1 — 标准包裹：
 *   <tool_call><name>write_file</name><path>...</path><content>...</content></tool_call>
 *
 * 格式 2 — 旧 JSON 包裹：
 *   <tool_call><name>write_file</name><args>{"path":"..."}</args></tool_call>
 *
 * 格式 3 — 裸输出（无 <tool_call> 包裹，模型漏写了外层标签）：
 *   <name>write_file</name><path>...</path><content>...</content>
 */
function extractToolCall(content: string): {
  toolCall: ParsedToolCall | null;
  text: string;
} {
  // --- 格式 1 & 2：有 <tool_call> 包裹 ---
  const wrappedRegex = /<tool_call>([\s\S]*?)<\/tool_call>/;
  const wrappedMatch = wrappedRegex.exec(content);

  if (wrappedMatch) {
    const result = parseToolBody(wrappedMatch[1]);
    if (result) {
      const text = content.replace(/<tool_call>[\s\S]*?<\/tool_call>/, "").trim();
      return { toolCall: result, text };
    }
  }

  // --- 格式 3：裸输出，通过已知工具名识别 ---
  const bareRegex = /<name>(\w+)<\/name>/;
  const bareMatch = bareRegex.exec(content);

  if (bareMatch && toolNames.has(bareMatch[1].trim())) {
    // 从 <name> 开始到最后一个闭合参数标签为止，当作工具调用体
    const startIdx = bareMatch.index;
    const result = parseToolBody(content.slice(startIdx));
    if (result) {
      const text = content.slice(0, startIdx).trim();
      return { toolCall: result, text };
    }
  }

  return { toolCall: null, text: content };
}

/**
 * 从工具调用体中解析出工具名 + 参数
 */
function parseToolBody(body: string): ParsedToolCall | null {
  const nameMatch = /<name>([\s\S]*?)<\/name>/.exec(body);
  if (!nameMatch) return null;

  const name = nameMatch[1].trim();

  // 优先：XML 子标签参数
  let args = parseXmlParams(body);

  // 回退：<args>JSON</args>
  if (Object.keys(args).length === 0) {
    args = parseJsonArgs(body);
  }

  if (Object.keys(args).length === 0) return null;

  return { name, args };
}

export function parseModelOutput(content: string): ParseResult {
  const { thinking, rest } = stripThinking(content);
  const { toolCall, text } = extractToolCall(rest);

  return { thinking, text, toolCall };
}
