import { spawn } from "child_process";
import { Tool } from "../types/index.js";
import { resolveSafePath } from "./pathSafety.js";

export class CommandExecTool implements Tool {
  name = "command_exec";
  description =
    "执行终端命令（如 git 命令）。支持传入命令、参数、工作目录和超时，返回 stdout/stderr/退出码。";
  parameters = {
    command: { type: "string", description: "要执行的命令，例如 git" },
    args: {
      type: "array",
      items: { type: "string" },
      description: "命令参数数组，例如 [\"status\", \"--short\"]",
    },
    cwd: { type: "string", description: "执行目录（相对工作区，默认 .）" },
    timeoutMs: { type: "number", description: "超时时间（毫秒），默认 20000，最大 120000" },
    maxOutputChars: { type: "number", description: "最大输出字符数，默认 8000，最大 50000" },
  };
  required = ["command"];

  private allowedDir: string;

  constructor(allowedDir: string = process.cwd()) {
    this.allowedDir = allowedDir;
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    let command = (params.command as string)?.trim();
    const cwdInput = (params.cwd as string) || ".";
    const timeoutRaw = Number(params.timeoutMs);
    const maxOutputRaw = Number(params.maxOutputChars);
    const timeoutMs = Number.isFinite(timeoutRaw)
      ? Math.min(Math.max(Math.floor(timeoutRaw), 1000), 120000)
      : 20000;
    const maxOutputChars = Number.isFinite(maxOutputRaw)
      ? Math.min(Math.max(Math.floor(maxOutputRaw), 1000), 50000)
      : 8000;

    if (!command) {
      return "错误：command 不能为空";
    }

    const safeCwd = resolveSafePath(this.allowedDir, cwdInput);
    if (!safeCwd) {
      return `错误：禁止在允许目录之外执行命令。cwd "${cwdInput}" 不安全。`;
    }

    let args: string[] = [];
    if (Array.isArray(params.args)) {
      args = params.args.map((x) => String(x));
    } else if (command.includes(" ")) {
      const parts = command.split(/\s+/).filter(Boolean);
      command = parts[0] || command;
      args = parts.slice(1);
    }

    return await this.runCommand(command, args, safeCwd, timeoutMs, maxOutputChars);
  }

  private async runCommand(
    command: string,
    args: string[],
    cwd: string,
    timeoutMs: number,
    maxOutputChars: number,
  ): Promise<string> {
    return await new Promise((resolve) => {
      const child = spawn(command, args, {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
        shell: false,
      });

      let stdout = "";
      let stderr = "";
      let timedOut = false;

      const append = (target: "stdout" | "stderr", chunk: Buffer): void => {
        const text = chunk.toString("utf-8");
        if (target === "stdout") {
          stdout = (stdout + text).slice(-maxOutputChars);
        } else {
          stderr = (stderr + text).slice(-maxOutputChars);
        }
      };

      child.stdout.on("data", (chunk: Buffer) => append("stdout", chunk));
      child.stderr.on("data", (chunk: Buffer) => append("stderr", chunk));

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, timeoutMs);

      child.on("error", (error) => {
        clearTimeout(timer);
        resolve(`执行失败：${error.message}`);
      });

      child.on("close", (code, signal) => {
        clearTimeout(timer);
        const out = stdout.trim();
        const err = stderr.trim();

        const lines: string[] = [];
        lines.push(`command: ${command}${args.length > 0 ? ` ${args.join(" ")}` : ""}`);
        lines.push(`cwd: ${cwd}`);
        lines.push(`exitCode: ${code ?? "null"}`);
        lines.push(`signal: ${signal ?? "null"}`);
        lines.push(`timedOut: ${timedOut ? "true" : "false"}`);
        lines.push("");
        lines.push("[stdout]");
        lines.push(out || "(empty)");
        lines.push("");
        lines.push("[stderr]");
        lines.push(err || "(empty)");
        resolve(lines.join("\n"));
      });
    });
  }
}
