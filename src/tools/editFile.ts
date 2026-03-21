import * as fs from "node:fs/promises";
import * as path from "node:path";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const editFileTool = tool(
  async ({ path: filePath, old_text, new_text }) => {
    try {
      const cwd = process.cwd();
      const safePath = filePath.replace(/^\/+/, "");
      const resolved = path.resolve(cwd, safePath);
      if (!resolved.startsWith(cwd)) {
        return "错误：不允许编辑工作目录之外的文件";
      }

      let content: string;
      try {
        content = await fs.readFile(resolved, "utf-8");
      } catch {
        return `错误：文件不存在: ${filePath}`;
      }

      // 统计匹配次数
      const occurrences = content.split(old_text).length - 1;

      if (occurrences === 0) {
        // 提供上下文帮助模型定位问题
        const lines = content.split("\n");
        const preview =
          lines.length <= 20
            ? content
            : lines.slice(0, 20).join("\n") + `\n... (共 ${lines.length} 行)`;
        return `错误：未找到要替换的文本。文件当前内容:\n${preview}`;
      }

      if (occurrences > 1) {
        return `错误：找到 ${occurrences} 处匹配，请提供更多上下文使其唯一`;
      }

      const updated = content.replace(old_text, new_text);
      await fs.writeFile(resolved, updated, "utf-8");

      // 生成 diff 摘要
      const oldLines = old_text.split("\n").length;
      const newLines = new_text.split("\n").length;
      return `文件已编辑: ${filePath} (替换了 ${oldLines} 行 → ${newLines} 行)`;
    } catch (err: unknown) {
      return `编辑文件失败: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
  {
    name: "edit_file",
    description:
      "通过精准的文本替换来编辑文件。需要提供要被替换的原始文本(old_text)和替换后的新文本(new_text)。" +
      "old_text 必须与文件中的内容完全匹配（包括缩进和空白），且只能匹配到一处。" +
      "适合修改现有代码，比 write_file 更安全。修改前请先用 read_file 查看文件内容。",
    schema: z.object({
      path: z.string().describe("要编辑的文件路径"),
      old_text: z
        .string()
        .describe("要被替换的原始文本，必须与文件中的内容完全一致"),
      new_text: z.string().describe("替换后的新文本"),
    }),
  }
);
