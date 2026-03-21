import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Tool } from "./types.js";

export const writeFileTool: Tool = {
  name: "write_file",
  description: "将内容写入指定路径的文件。会自动创建不存在的目录。路径相对于当前工作目录。",
  parameters: [
    {
      name: "path",
      type: "string",
      description: "要写入的文件路径",
      required: true,
    },
    {
      name: "content",
      type: "string",
      description: "要写入的文件内容",
      required: true,
    },
  ],
  async execute(args) {
    const cwd = process.cwd();
    const filePath = path.resolve(cwd, args.path);
    // 安全校验：不可写 cwd 之外
    if (!filePath.startsWith(cwd)) {
      return "错误：不允许写入工作目录之外的文件";
    }
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, args.content, "utf-8");
    return `文件已写入: ${args.path}`;
  },
};
