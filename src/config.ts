import * as fs from "node:fs";
import * as path from "node:path";

export interface MiniCCConfig {
  /** 允许自动执行的命令前缀列表，如 ["ls", "cat", "git status"] */
  allowedCommands: string[];
}

const DEFAULT_CONFIG: MiniCCConfig = {
  allowedCommands: [],
};

const CONFIG_FILE = ".mini-cc.json";

let cachedConfig: MiniCCConfig | null = null;

export function loadConfig(): MiniCCConfig {
  if (cachedConfig) return cachedConfig;

  const configPath = path.resolve(process.cwd(), CONFIG_FILE);
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    cachedConfig = { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    cachedConfig = { ...DEFAULT_CONFIG };
  }
  return cachedConfig!;
}

/**
 * 检查命令是否在白名单中
 * 匹配规则：命令以白名单中的某个前缀开头即可
 * 例如白名单 ["ls", "git status"] 可以匹配 "ls -la", "git status --short"
 */
export function isCommandAllowed(command: string): boolean {
  const config = loadConfig();
  const trimmed = command.trim();
  return config.allowedCommands.some((prefix) => {
    const p = prefix.trim();
    return trimmed === p || trimmed.startsWith(p + " ");
  });
}
