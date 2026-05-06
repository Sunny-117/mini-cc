import { Tool } from "../types/index.js";
import * as fs from "fs";
import { resolveSafePath } from "./pathSafety.js";

export class FileReadTool implements Tool {
  name = "file_read";
  description = "读取本地文件内容。输入文件路径，返回文件内容。";
  parameters = {
    filePath: { type: "string", description: "要读取的文件路径" },
  };
  required = ["filePath"];

  private allowedDir: string;

  constructor(allowedDir: string = process.cwd()) {
    this.allowedDir = allowedDir;
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const filePath = params.filePath as string;
    if (!filePath || typeof filePath !== "string") {
      return "错误：filePath 参数无效";
    }

    const normalized = resolveSafePath(this.allowedDir, filePath);
    if (!normalized) {
      return `错误：禁止访问允许目录之外的文件。文件路径 "${filePath}" 不安全。`;
    }

    try {
      if (!fs.existsSync(normalized)) {
        return `错误：文件 "${filePath}" 不存在`;
      }

      const stat = fs.statSync(normalized);
      if (stat.isDirectory()) {
        return `错误："${filePath}" 是一个目录，不是文件`;
      }

      const content = fs.readFileSync(normalized, "utf-8");

      if (content.length > 10000) {
        return content.slice(0, 10000) + "\n\n... (文件过长，已截断)";
      }

      return content;
    } catch (error) {
      return `错误：读取文件失败 - ${error instanceof Error ? error.message : "未知错误"}`;
    }
  }
}
