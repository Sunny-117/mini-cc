import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Tool } from "./types.js";

export const readFileTool: Tool = {
  name: "read_file",
  description: "读取指定路径的文件内容。路径相对于当前工作目录。",
  parameters: [
    {
      name: "path",
      type: "string",
      description: "要读取的文件路径",
      required: true,
    },
  ],
  async execute(args) {
    const filePath = path.resolve(process.cwd(), args.path);
    const stat = await fs.stat(filePath);
    if (stat.size > 100 * 1024) {
      return `错误：文件过大（${(stat.size / 1024).toFixed(1)}KB），限制 100KB`;
    }
    const content = await fs.readFile(filePath, "utf-8");
    return content;
  },
};
