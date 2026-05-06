import { Tool } from "../types/index.js";
import * as fs from "fs";
import * as path from "path";
import { relativeToBase, resolveSafePath } from "./pathSafety.js";

export class FileFindTool implements Tool {
  name = "file_find";
  description = "按名称关键词在指定目录中查找文件或目录路径。";
  parameters = {
    keyword: { type: "string", description: "要匹配的文件名关键词（不区分大小写）" },
    dirPath: { type: "string", description: "查找起始目录（默认 .）" },
    maxResults: { type: "number", description: "最多返回结果数，默认 100" },
  };
  required = ["keyword"];

  private allowedDir: string;

  constructor(allowedDir: string = process.cwd()) {
    this.allowedDir = allowedDir;
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const keyword = (params.keyword as string)?.trim();
    const dirPath = (params.dirPath as string) || ".";
    const maxResultsRaw = Number(params.maxResults);
    const maxResults = Number.isFinite(maxResultsRaw)
      ? Math.min(Math.max(Math.floor(maxResultsRaw), 1), 1000)
      : 100;

    if (!keyword) {
      return "错误：keyword 不能为空";
    }

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

      const matches: string[] = [];
      const key = keyword.toLowerCase();

      const walk = (current: string): void => {
        if (matches.length >= maxResults) {
          return;
        }

        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
          if (matches.length >= maxResults) {
            return;
          }

          const fullPath = path.join(current, entry.name);
          if (entry.name.toLowerCase().includes(key)) {
            matches.push(relativeToBase(this.allowedDir, fullPath));
          }

          if (entry.isDirectory()) {
            walk(fullPath);
          }
        }
      };

      walk(normalized);

      if (matches.length === 0) {
        return `未找到包含 "${keyword}" 的文件或目录`;
      }

      const truncated = matches.length >= maxResults
        ? `\n... (已达到上限 ${maxResults} 条)`
        : "";
      return matches.join("\n") + truncated;
    } catch (error) {
      return `错误：查找文件失败 - ${error instanceof Error ? error.message : "未知错误"}`;
    }
  }
}
