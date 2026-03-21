import { glob } from "glob";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const listFilesTool = tool(
  async ({ pattern }) => {
    try {
      const p = pattern || "*";
      const files = await glob(p, {
        cwd: process.cwd(),
        ignore: ["node_modules/**", ".git/**", "dist/**"],
        nodir: false,
      });
      if (files.length === 0) {
        return "没有匹配的文件";
      }
      return files.sort().join("\n");
    } catch (err: unknown) {
      return `列出文件失败: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
  {
    name: "list_files",
    description: "列出匹配 glob 模式的文件。默认列出当前目录所有文件。",
    schema: z.object({
      pattern: z.string().optional().describe("glob 模式，例如 '**/*.ts' 或 'src/**'。默认: '*'"),
    }),
  }
);
