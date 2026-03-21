import { glob } from "glob";
import type { Tool } from "./types.js";

export const listFilesTool: Tool = {
  name: "list_files",
  description: "列出匹配 glob 模式的文件。默认列出当前目录所有文件。",
  parameters: [
    {
      name: "pattern",
      type: "string",
      description: "glob 模式，例如 '**/*.ts' 或 'src/**'。默认: '*'",
      required: false,
    },
  ],
  async execute(args) {
    const pattern = args.pattern || "*";
    const files = await glob(pattern, {
      cwd: process.cwd(),
      ignore: ["node_modules/**", ".git/**", "dist/**"],
      nodir: false,
    });
    if (files.length === 0) {
      return "没有匹配的文件";
    }
    return files.sort().join("\n");
  },
};
