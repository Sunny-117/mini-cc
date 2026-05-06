import { Agent } from "./Agent.js";
import { MemoryStore } from "../memory/MemoryStore.js";
import { Message } from "../types/index.js";
import { ToolCall } from "../types/index.js";

type LogMessage = {
  role: string;
  content?: unknown;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    function: {
      name: string;
      arguments: string;
    };
  }>;
};

const COLOR = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
} as const;

export class AgentLoop {
  private agent: Agent;
  private memory: MemoryStore;
  private maxIterations: number;

  constructor(agent: Agent, memory: MemoryStore, maxIterations: number = 10) {
    this.agent = agent;
    this.memory = memory;
    this.maxIterations = maxIterations;
  }

  async run(input: string, sessionId: string): Promise<string> {
    const history = await this.memory.buildContextMessages(sessionId, input);
    this.logTurnStart(sessionId, input, history);

    const messages = this.agent.buildMessages(history, input);
    this.logLlmRequest(messages);

    let iteration = 0;
    let lastContent = "";
    let toolCalls: ToolCall[] | undefined;

    while (iteration < this.maxIterations) {
      iteration++;

      const response = await this.agent.call(messages);
      this.logLlmResponse(iteration, response.content, response.toolCalls);

      if (response.toolCalls && response.toolCalls.length > 0) {
        toolCalls = response.toolCalls;

        messages.push({
          role: "assistant",
          content: response.content,
          tool_calls: toolCalls,
        });

        console.log(`\n[工具调用 ${iteration}]`);
        for (const tc of toolCalls) {
          console.log(`  - ${tc.function.name}: ${tc.function.arguments}`);
        }

        for (const toolCall of toolCalls) {
          const result = await this.agent.executeToolCall(toolCall);

          console.log(`\n[工具结果]`);
          console.log(`  ${result.slice(0, 200)}${result.length > 200 ? "..." : ""}`);

          messages.push({
            role: "tool",
            content: result,
            tool_call_id: toolCall.id,
          });
          this.logToolResult(toolCall, result);
        }

        continue;
      }

      lastContent = response.content;

      break;
    }

    if (iteration >= this.maxIterations) {
      lastContent = `达到最大迭代次数 (${this.maxIterations})，停止执行。`;
    }

    this.memory.appendTurn(sessionId, input, lastContent);
    this.logTurnEnd(sessionId, lastContent);

    return lastContent;
  }

  private logTurnStart(sessionId: string, input: string, history: Message[]): void {
    console.log(`\n${COLOR.bold}${COLOR.cyan}================ 对话日志开始 ================${COLOR.reset}`);
    console.log(`${COLOR.gray}[Session]${COLOR.reset} ${sessionId}`);
    console.log(`${COLOR.bold}${COLOR.yellow}[Prompt]${COLOR.reset} ${input}`);
    console.log(`${COLOR.bold}${COLOR.blue}[Context from Memory]${COLOR.reset}`);
    console.log(this.formatMessages(history));
  }

  private logLlmRequest(messages: LogMessage[]): void {
    console.log(`${COLOR.bold}${COLOR.magenta}[LLM Request Messages]${COLOR.reset}`);
    console.log(this.formatMessages(messages));
  }

  private logLlmResponse(iteration: number, content: string, toolCalls?: ToolCall[]): void {
    console.log(`${COLOR.bold}${COLOR.green}[LLM Response]${COLOR.reset}${COLOR.dim}[iteration=${iteration}]${COLOR.reset}`);
    console.log(`${COLOR.green}[content]${COLOR.reset} ${content || "(empty)"}`);
    if (toolCalls && toolCalls.length > 0) {
      console.log(`${COLOR.yellow}[tool_calls]${COLOR.reset}`);
      for (const tc of toolCalls) {
        console.log(
          `  ${COLOR.yellow}- id=${tc.id} name=${tc.function.name} args=${tc.function.arguments}${COLOR.reset}`,
        );
      }
    }
  }

  private logToolResult(toolCall: ToolCall, result: string): void {
    console.log(`${COLOR.bold}${COLOR.blue}[Tool Result]${COLOR.reset}${COLOR.dim}[${toolCall.function.name}]${COLOR.reset}`);
    console.log(result);
  }

  private logTurnEnd(sessionId: string, output: string): void {
    console.log(`${COLOR.bold}${COLOR.cyan}[Turn End]${COLOR.reset}${COLOR.dim}[${sessionId}]${COLOR.reset}`);
    console.log(`${COLOR.bold}${COLOR.green}[Assistant Output]${COLOR.reset} ${output}`);
    console.log(`${COLOR.bold}${COLOR.cyan}================ 对话日志结束 ================${COLOR.reset}\n`);
  }

  private formatMessages(messages: LogMessage[]): string {
    if (messages.length === 0) return "(empty)";

    const lines: string[] = [];
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const roleColor =
        msg.role === "system"
          ? COLOR.magenta
          : msg.role === "user"
            ? COLOR.yellow
            : msg.role === "assistant"
              ? COLOR.green
              : COLOR.blue;
      lines.push(
        `${COLOR.gray}- [${i}]${COLOR.reset} ${roleColor}role=${msg.role}${COLOR.reset}${msg.tool_call_id ? ` ${COLOR.dim}tool_call_id=${msg.tool_call_id}${COLOR.reset}` : ""}`,
      );
      if (typeof msg.content === "string") {
        lines.push(msg.content || "(empty)");
      } else if (Array.isArray(msg.content)) {
        lines.push(JSON.stringify(msg.content));
      } else if (msg.content === undefined || msg.content === null) {
        lines.push("(empty)");
      } else {
        lines.push(String(msg.content));
      }
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        for (const tc of msg.tool_calls) {
          lines.push(
            `  ${COLOR.yellow}tool_call:${COLOR.reset} id=${tc.id} name=${tc.function.name} args=${tc.function.arguments}`,
          );
        }
      }
    }
    return lines.join("\n");
  }
}
