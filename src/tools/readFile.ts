import * as fs from "node:fs/promises";
import * as path from "node:path";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const readFileTool = tool(
  async ({ path: filePath }) => {
    try {
      // 将绝对路径转为相对路径，防止模型误传 "/package.json" 等
      const safePath = filePath.replace(/^\/+/, "");
      const resolved = path.resolve(process.cwd(), safePath);
      const stat = await fs.stat(resolved);
      if (stat.size > 100 * 1024) {
        return `错误：文件过大（${(stat.size / 1024).toFixed(1)}KB），限制 100KB`;
      }
      return await fs.readFile(resolved, "utf-8");
    } catch (err: unknown) {
      return `读取文件失败: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
  {
    name: "read_file",
    description: "读取指定路径的文件内容。路径相对于当前工作目录。",
    schema: z.object({
      path: z.string().describe("要读取的文件路径"),
    }),
  }
);
