import { execSync } from "node:child_process";
import type { Tool } from "./types.js";

export const runCommandTool: Tool = {
  name: "run_command",
  description: "执行 shell 命令并返回输出。超时 30 秒。",
  parameters: [
    {
      name: "command",
      type: "string",
      description: "要执行的 shell 命令",
      required: true,
    },
  ],
  async execute(args) {
    try {
      const result = execSync(args.command, {
        cwd: process.cwd(),
        encoding: "utf-8",
        timeout: 30000,
        maxBuffer: 1024 * 1024,
      });
      const output = result.trim();
      if (output.length > 10000) {
        return output.slice(0, 10000) + "\n... (输出已截断)";
      }
      return output || "(命令执行成功，无输出)";
    } catch (err: unknown) {
      if (err && typeof err === "object" && "stderr" in err) {
        return `命令执行失败:\n${(err as { stderr: string }).stderr}`;
      }
      return `命令执行失败: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};
