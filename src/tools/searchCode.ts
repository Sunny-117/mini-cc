import { execSync } from "node:child_process";
import type { Tool } from "./types.js";

export const searchCodeTool: Tool = {
  name: "search_code",
  description: "在代码文件中搜索匹配的文本或正则表达式。返回匹配的文件名和行。",
  parameters: [
    {
      name: "pattern",
      type: "string",
      description: "搜索的文本或正则表达式",
      required: true,
    },
    {
      name: "path",
      type: "string",
      description: "搜索的目录路径，默认为当前目录",
      required: false,
    },
  ],
  async execute(args) {
    const searchPath = args.path || ".";
    const pattern = args.pattern;
    try {
      const result = execSync(
        `grep -rn --include='*.ts' --include='*.js' --include='*.json' --include='*.md' --include='*.tsx' --include='*.jsx' --include='*.py' --include='*.go' --include='*.rs' ${JSON.stringify(pattern)} ${JSON.stringify(searchPath)}`,
        {
          cwd: process.cwd(),
          encoding: "utf-8",
          timeout: 10000,
          maxBuffer: 1024 * 1024,
        }
      );
      const lines = result.trim().split("\n");
      if (lines.length > 50) {
        return lines.slice(0, 50).join("\n") + `\n... (共 ${lines.length} 条结果，仅显示前 50 条)`;
      }
      return result.trim() || "没有找到匹配结果";
    } catch {
      return "没有找到匹配结果";
    }
  },
};
