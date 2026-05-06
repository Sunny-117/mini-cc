import { ToolRegistry } from "./ToolRegistry.js";
import { WebSearchTool } from "./WebSearchTool.js";
import { FileReadTool } from "./FileReadTool.js";
import { FileWriteTool } from "./FileWriteTool.js";
import { DirectoryListTool } from "./DirectoryListTool.js";
import { FileFindTool } from "./FileFindTool.js";
import { CommandExecTool } from "./CommandExecTool.js";

export { ToolRegistry } from "./ToolRegistry.js";
export { WebSearchTool } from "./WebSearchTool.js";
export { FileReadTool } from "./FileReadTool.js";
export { FileWriteTool } from "./FileWriteTool.js";
export { DirectoryListTool } from "./DirectoryListTool.js";
export { FileFindTool } from "./FileFindTool.js";
export { CommandExecTool } from "./CommandExecTool.js";

export function createDefaultToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  const mockMode = process.env.SEARCH_API_MOCK !== "false";
  const searchApiKey = process.env.SEARCH_API_KEY;
  const workspace = process.cwd();

  registry.register(new WebSearchTool(mockMode, searchApiKey));
  registry.register(new FileReadTool(workspace));
  registry.register(new FileWriteTool(workspace));
  registry.register(new DirectoryListTool(workspace));
  registry.register(new FileFindTool(workspace));
  registry.register(new CommandExecTool(workspace));

  return registry;
}
