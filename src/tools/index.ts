import { readFileTool } from "./readFile.js";
import { writeFileTool } from "./writeFile.js";
import { editFileTool } from "./editFile.js";
import { listFilesTool } from "./listFiles.js";
import { searchCodeTool } from "./searchCode.js";
import { runCommandTool } from "./runCommand.js";

export const tools = [
  readFileTool,
  writeFileTool,
  editFileTool,
  listFilesTool,
  searchCodeTool,
  runCommandTool,
];
