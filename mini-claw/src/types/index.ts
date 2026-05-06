export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolResult {
  tool_call_id: string;
  content: string;
}

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  required?: string[];
  execute(params: Record<string, unknown>): Promise<string>;
}

export interface Session {
  id: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentConfig {
  model: string;
  apiKey: string;
  baseURL?: string;
  maxTokens?: number;
  temperature?: number;
  maxIterations?: number;
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, { type: string; description?: string }>;
      required?: string[];
    };
  };
}
