import type { Message } from "ollama";
import { chat } from "../llm/ollama.js";
import { tools, toolMap } from "../tools/index.js";
import { buildSystemPrompt } from "./prompt.js";
import { parseModelOutput } from "./parser.js";

const MAX_ITERATIONS = 15;

export type AgentEventType = "thinking" | "tool_call" | "tool_result" | "response" | "error";

export interface AgentEvent {
  type: AgentEventType;
  data: string;
  toolName?: string;
}

export type AgentCallback = (event: AgentEvent) => void;

export async function runAgent(
  userMessage: string,
  history: Message[],
  callback?: AgentCallback
): Promise<{ response: string; history: Message[] }> {
  const systemPrompt = buildSystemPrompt(tools);

  const messages: Message[] = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: userMessage },
  ];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const rawOutput = await chat({ messages });

    const parsed = parseModelOutput(rawOutput);

    if (parsed.thinking) {
      callback?.({ type: "thinking", data: parsed.thinking });
    }

    if (!parsed.toolCall) {
      // 没有工具调用，这是最终回复
      const finalText = parsed.text || rawOutput;
      callback?.({ type: "response", data: finalText });

      // 更新对话历史
      const newHistory: Message[] = [
        ...history,
        { role: "user", content: userMessage },
        { role: "assistant", content: finalText },
      ];

      return { response: finalText, history: newHistory };
    }

    // 有工具调用
    const { name, args } = parsed.toolCall;
    callback?.({
      type: "tool_call",
      data: JSON.stringify(args),
      toolName: name,
    });

    const tool = toolMap.get(name);
    let toolResult: string;
    if (!tool) {
      toolResult = `错误：未知工具 "${name}"。可用工具: ${tools.map((t) => t.name).join(", ")}`;
    } else {
      try {
        toolResult = await tool.execute(args);
      } catch (err: unknown) {
        toolResult = `工具执行错误: ${err instanceof Error ? err.message : String(err)}`;
      }
    }

    callback?.({
      type: "tool_result",
      data: toolResult.length > 500
        ? toolResult.slice(0, 500) + "... (已截断)"
        : toolResult,
      toolName: name,
    });

    // 将助手回复和工具结果加入消息
    messages.push({ role: "assistant", content: rawOutput });
    messages.push({
      role: "user",
      content: `<tool_result>\n${toolResult}\n</tool_result>`,
    });
  }

  // 超过最大迭代次数
  const errorMsg = "已达到最大迭代次数，请尝试简化你的请求。";
  callback?.({ type: "error", data: errorMsg });

  const newHistory: Message[] = [
    ...history,
    { role: "user", content: userMessage },
    { role: "assistant", content: errorMsg },
  ];

  return { response: errorMsg, history: newHistory };
}
