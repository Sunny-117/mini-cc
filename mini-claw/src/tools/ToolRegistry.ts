import { Tool, ToolDefinition } from "../types/index.js";

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  getToolsForPrompt(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: "object",
          properties: tool.parameters as Record<
            string,
            { type: string; description?: string }
          >,
          required: tool.required ?? Object.keys(tool.parameters),
        },
      },
    }));
  }

  getToolDescriptions(): string {
    const lines: string[] = [];
    for (const tool of this.tools.values()) {
      lines.push(`- ${tool.name}: ${tool.description}`);
    }
    return lines.join("\n");
  }
}
