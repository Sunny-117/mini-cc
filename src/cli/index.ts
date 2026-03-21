import * as readline from "node:readline";
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import type { Message } from "ollama";
import { runAgent, type AgentCallback } from "../agent/agent.js";
import { getModel } from "../llm/ollama.js";

function createAgentCallback(spinner: ReturnType<typeof ora>): AgentCallback {
  return (event) => {
    switch (event.type) {
      case "thinking":
        spinner.text = "思考中...";
        break;
      case "tool_call":
        spinner.stop();
        console.log(
          chalk.cyan(`  🔧 调用工具: ${event.toolName}`) +
            chalk.gray(` ${event.data}`)
        );
        spinner.start("等待工具执行...");
        break;
      case "tool_result":
        spinner.stop();
        console.log(chalk.gray(`  📋 结果: ${event.data}`));
        spinner.start("继续思考...");
        break;
      case "response":
        spinner.stop();
        break;
      case "error":
        spinner.stop();
        console.log(chalk.red(`  ❌ ${event.data}`));
        break;
    }
  };
}

async function chatLoop() {
  console.log(
    chalk.bold.green("\n🤖 Mini Claude Code") +
      chalk.gray(` (模型: ${getModel()})`)
  );
  console.log(chalk.gray("输入你的问题，输入 /exit 退出，/clear 清除历史\n"));

  let history: Message[] = [];

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise((resolve) => rl.question(prompt, resolve));

  while (true) {
    const input = await question(chalk.blue("❯ "));
    const trimmed = input.trim();

    if (!trimmed) continue;

    if (trimmed === "/exit" || trimmed === "/quit") {
      console.log(chalk.gray("再见！👋"));
      rl.close();
      process.exit(0);
    }

    if (trimmed === "/clear") {
      history = [];
      console.log(chalk.gray("对话历史已清除。\n"));
      continue;
    }

    const spinner = ora({ text: "思考中...", color: "cyan", discardStdin: false }).start();
    const callback = createAgentCallback(spinner);

    try {
      const result = await runAgent(trimmed, history, callback);
      history = result.history;
      spinner.stop();
      console.log(chalk.white("\n" + result.response + "\n"));
    } catch (err: unknown) {
      spinner.stop();
      console.log(
        chalk.red(
          `\n错误: ${err instanceof Error ? err.message : String(err)}\n`
        )
      );
    }
  }
}

async function askOnce(query: string) {
  const spinner = ora({ text: "思考中...", color: "cyan" }).start();
  const callback = createAgentCallback(spinner);

  try {
    const result = await runAgent(query, [], callback);
    spinner.stop();
    console.log(chalk.white("\n" + result.response + "\n"));
  } catch (err: unknown) {
    spinner.stop();
    console.error(
      chalk.red(
        `错误: ${err instanceof Error ? err.message : String(err)}`
      )
    );
    process.exit(1);
  }
}

export function createCli() {
  const program = new Command();

  program
    .name("mini-cc")
    .description("Mini Claude Code - 本地代码助手 CLI")
    .version("0.1.0");

  program
    .command("chat")
    .description("进入交互式聊天模式")
    .action(chatLoop);

  program
    .command("ask <query>")
    .description("单次提问")
    .action(askOnce);

  // 默认进入 chat 模式
  program.action(chatLoop);

  return program;
}
