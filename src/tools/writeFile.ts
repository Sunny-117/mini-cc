import * as fs from "node:fs/promises";
import * as path from "node:path";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const writeFileTool = tool(
  async ({ path: filePath, content }) => {
    try {
      const cwd = process.cwd();
      // 将绝对路径转为相对路径，防止模型误传 "/index.html" 等
      const safePath = filePath.replace(/^\/+/, "");
      const resolved = path.resolve(cwd, safePath);
      if (!resolved.startsWith(cwd)) {
        return "错误：不允许写入工作目录之外的文件";
      }
      await fs.mkdir(path.dirname(resolved), { recursive: true });
      await fs.writeFile(resolved, content, "utf-8");
      return `文件已写入: ${filePath}`;
    } catch (err: unknown) {
      return `写入文件失败: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
  {
    name: "write_file",
    description: "将内容写入指定路径的文件。会自动创建不存在的目录。路径相对于当前工作目录。",
    schema: z.object({
      path: z.string().describe("要写入的文件路径"),
      content: z.string().describe("要写入的文件内容"),
    }),
  }
);
