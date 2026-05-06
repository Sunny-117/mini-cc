import { Tool } from "../types/index.js";
import * as fs from "fs";
import * as path from "path";
import { relativeToBase, resolveSafePath } from "./pathSafety.js";

export class DirectoryListTool implements Tool {
  name = "directory_list";
  description =
    "列出目录中的文件和子目录。可选递归遍历，并限制返回条目数量。";
  parameters = {
    dirPath: { type: "string", description: "要列出的目录路径（默认 .）" },
    recursive: { type: "boolean", description: "是否递归列出子目录，默认 false" },
    maxEntries: { type: "number", description: "最多返回的条目数，默认 200" },
  };
  required = [];

  private allowedDir: string;

  constructor(allowedDir: string = process.cwd()) {
    this.allowedDir = allowedDir;
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const dirPath = (params.dirPath as string) || ".";
    const recursive = Boolean(params.recursive);
    const maxEntriesRaw = Number(params.maxEntries);
    const maxEntries = Number.isFinite(maxEntriesRaw)
      ? Math.min(Math.max(Math.floor(maxEntriesRaw), 1), 1000)
      : 200;

    const normalized = resolveSafePath(this.allowedDir, dirPath);
    if (!normalized) {
      return `错误：禁止访问允许目录之外的路径。目录路径 "${dirPath}" 不安全。`;
    }

    try {
      if (!fs.existsSync(normalized)) {
        return `错误：目录 "${dirPath}" 不存在`;
      }

      const stat = fs.statSync(normalized);
      if (!stat.isDirectory()) {
        return `错误："${dirPath}" 不是目录`;
      }

      const lines: string[] = [];
      let count = 0;
      let truncated = false;

      const walk = (current: string): void => {
        if (count >= maxEntries || truncated) {
          truncated = true;
          return;
        }

        const entries = fs.readdirSync(current, { withFileTypes: true });
        entries.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));

        for (const entry of entries) {
          if (count >= maxEntries) {
            truncated = true;
            return;
          }

          const fullPath = path.join(current, entry.name);
          const rel = relativeToBase(this.allowedDir, fullPath);
          lines.push(`${entry.isDirectory() ? "[D]" : "[F]"} ${rel}`);
          count++;

          if (recursive && entry.isDirectory()) {
            walk(fullPath);
          }
        }
      };

      walk(normalized);

      const suffix = truncated ? `\n... (已截断，最多 ${maxEntries} 条)` : "";
      return lines.length > 0 ? `${lines.join("\n")}${suffix}` : "(空目录)";
    } catch (error) {
      return `错误：读取目录失败 - ${error instanceof Error ? error.message : "未知错误"}`;
    }
  }
}
