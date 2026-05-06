import OpenAI from "openai";
import { AgentConfig, Message, ToolCall, ToolDefinition } from "../types/index.js";
import { ToolRegistry } from "../tools/index.js";

export class Agent {
  private client: OpenAI;
  private config: AgentConfig;
  private toolRegistry: ToolRegistry;

  constructor(config: AgentConfig, toolRegistry: ToolRegistry) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
    this.config = config;
    this.toolRegistry = toolRegistry;
  }

  getSystemPrompt(): string {
    const toolDescriptions = this.toolRegistry.getToolDescriptions();
    return `你是一个 AI 助手，可以通过工具帮助用户完成各种任务。

你拥有的工具：
${toolDescriptions}

使用规则：
1. 根据用户需求选择最合适的工具，优先复用已有工具结果
2. 在调用工具前，先简要说明你的意图
3. 基于工具返回结果回答问题，不要编造信息
4. 若工具返回错误，先解释错误并尝试可行替代方案
5. 响应应当简洁直接

能力边界规则（必须遵守）：
1. 你只能使用上面列出的工具，不能声称自己执行了未提供的能力
2. 如果是 git/终端类请求，优先使用 command_exec 工具执行，并基于真实执行结果回复
3. 只有当请求超出已提供工具能力时，才说明无法直接执行并给替代方案`;
  }

  buildMessages(history: Message[], currentInput: string): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: this.getSystemPrompt() },
      ...history.map((msg) => {
        if (msg.role === "tool") {
          return {
            role: "tool" as const,
            tool_call_id: msg.tool_call_id!,
            content: msg.content,
          };
        }
        return {
          role: msg.role as "system" | "user" | "assistant",
          content: msg.content,
        };
      }),
      { role: "user", content: currentInput },
    ];

    return messages;
  }

  getTools(): ToolDefinition[] {
    return this.toolRegistry.getToolsForPrompt();
  }

  async call(messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]): Promise<{
    content: string;
    toolCalls: ToolCall[] | undefined;
  }> {
    const response = await this.client.chat.completions.create({
      model: this.config.model,
      messages,
      tools: this.getTools().length > 0 ? this.getTools() : undefined,
      max_tokens: this.config.maxTokens || 4096,
      temperature: this.config.temperature || 0.7,
    });

    const message = response.choices[0]?.message;

    if (!message) {
      return { content: "Error: No response from LLM", toolCalls: undefined };
    }

    return {
      content: message.content || "",
      toolCalls: message.tool_calls as ToolCall[] | undefined,
    };
  }

  async executeToolCall(toolCall: ToolCall): Promise<string> {
    const { name, arguments: args } = toolCall.function;
    let params: Record<string, unknown>;
    try {
      params = args ? (JSON.parse(args) as Record<string, unknown>) : {};
    } catch (error) {
      return `Error: Invalid tool arguments JSON - ${error instanceof Error ? error.message : "Unknown error"}`;
    }

    const tool = this.toolRegistry.get(name);
    if (!tool) {
      return `Error: Tool "${name}" not found`;
    }

    try {
      const result = await tool.execute(params);
      return result;
    } catch (error) {
      return `Error executing tool: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  }
}
