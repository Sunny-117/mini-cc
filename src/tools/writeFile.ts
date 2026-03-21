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
    description:
      "创建新文件并写入内容。仅用于创建不存在的新文件。" +
      "如果要修改已有文件，必须使用 edit_file 工具，不要用 write_file 覆盖。",
    schema: z.object({
      path: z.string().describe("要写入的文件路径"),
      content: z.string().describe("要写入的文件内容"),
    }),
  }
);
