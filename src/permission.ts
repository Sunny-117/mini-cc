import * as readline from "node:readline";
import chalk from "chalk";
import type ora from "ora";

let rlInstance: readline.Interface | null = null;
let activeSpinner: ReturnType<typeof ora> | null = null;

/** 注入 readline 实例，供交互式确认使用 */
export function setReadline(rl: readline.Interface) {
  rlInstance = rl;
}

/** 注入当前活跃的 spinner，确认时自动暂停/恢复 */
export function setSpinner(spinner: ReturnType<typeof ora> | null) {
  activeSpinner = spinner;
}

/**
 * 在终端询问用户是否允许执行命令
 * 返回 true 表示允许，false 表示拒绝
 */
export function confirmCommand(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!rlInstance) {
      // 没有 readline（如 askOnce 模式），默认拒绝
      resolve(false);
      return;
    }

    // 暂停 spinner，避免覆盖确认提示
    const wasSpinning = activeSpinner?.isSpinning ?? false;
    if (wasSpinning) activeSpinner!.stop();

    console.log(
      chalk.yellow(`\n⚠️  即将执行命令: `) + chalk.bold(command)
    );
    rlInstance.question(
      chalk.yellow("  是否允许执行？(y/N) "),
      (answer) => {
        const allowed = answer.trim().toLowerCase() === "y";
        if (!allowed) {
          console.log(chalk.gray("  已拒绝执行。"));
        }

        // 恢复 spinner
        if (wasSpinning) activeSpinner!.start("执行中...");

        resolve(allowed);
      }
    );
  });
}
