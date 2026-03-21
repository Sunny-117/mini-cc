import type { Tool } from "./types.js";
import { readFileTool } from "./readFile.js";
import { writeFileTool } from "./writeFile.js";
import { listFilesTool } from "./listFiles.js";
import { searchCodeTool } from "./searchCode.js";
import { runCommandTool } from "./runCommand.js";

export const tools: Tool[] = [
  readFileTool,
  writeFileTool,
  listFilesTool,
  searchCodeTool,
  runCommandTool,
];

export const toolMap = new Map<string, Tool>(
  tools.map((t) => [t.name, t])
);

export type { Tool, ToolParameter } from "./types.js";
