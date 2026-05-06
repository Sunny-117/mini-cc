import { Tool } from "../types/index.js";
import * as fs from "fs";
import * as path from "path";
import { resolveSafePath } from "./pathSafety.js";

export class FileWriteTool implements Tool {
  name = "file_write";
  description = "写入本地文件。支持覆盖写入或追加写入，可自动创建父目录。";
  parameters = {
    filePath: { type: "string", description: "目标文件路径" },
    content: { type: "string", description: "要写入的内容" },
    mode: {
      type: "string",
      description: "写入模式：overwrite 覆盖，append 追加（默认 overwrite）",
    },
  };
  required = ["filePath", "content"];

  private allowedDir: string;

  constructor(allowedDir: string = process.cwd()) {
    this.allowedDir = allowedDir;
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const filePath = params.filePath as string;
    const content = params.content as string;
    const mode = (params.mode as string) || "overwrite";

    if (!filePath || typeof filePath !== "string") {
      return "错误：filePath 参数无效";
    }
    if (typeof content !== "string") {
      return "错误：content 参数无效，必须为字符串";
    }
    if (mode !== "overwrite" && mode !== "append") {
      return '错误：mode 参数无效，仅支持 "overwrite" 或 "append"';
    }

    const normalized = resolveSafePath(this.allowedDir, filePath);
    if (!normalized) {
      return `错误：禁止写入允许目录之外的文件。文件路径 "${filePath}" 不安全。`;
    }

    try {
      const parent = path.dirname(normalized);
      if (!fs.existsSync(parent)) {
        fs.mkdirSync(parent, { recursive: true });
      }

      if (mode === "append") {
        fs.appendFileSync(normalized, content, "utf-8");
      } else {
        fs.writeFileSync(normalized, content, "utf-8");
      }

      return `写入成功：${normalized}`;
    } catch (error) {
      return `错误：写入文件失败 - ${error instanceof Error ? error.message : "未知错误"}`;
    }
  }
}
