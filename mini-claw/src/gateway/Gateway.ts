import * as readline from "readline";
import { AgentLoop } from "../agent/AgentLoop.js";
import { MemoryStore } from "../memory/MemoryStore.js";
import { Message } from "../types/index.js";

export class Gateway {
  private rl: readline.Interface;
  private agentLoop: AgentLoop;
  private memory: MemoryStore;
  private running: boolean = false;

  constructor(agentLoop: AgentLoop, memory: MemoryStore) {
    this.agentLoop = agentLoop;
    this.memory = memory;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async start(): Promise<void> {
    this.running = true;
    const session = this.memory.createSession();

    console.log("\n=== Mini OpenClaw Agent 已启动 ===");
    console.log(`会话 ID: ${session.id}`);
    console.log('输入 "/new" 创建新会话，"/exit" 退出\n');

    await this.chatLoop();
  }

  private async chatLoop(): Promise<void> {
    while (this.running) {
      const session = this.memory.getCurrentSession();
      if (!session) {
        break;
      }

      const input = await this.prompt("You: ");

      if (!input || input.trim() === "") {
        continue;
      }

      if (input === "/exit") {
        console.log("\n再见！");
        this.running = false;
        break;
      }

      if (input === "/new") {
        const newSession = this.memory.createSession();
        console.log(`\n已创建新会话: ${newSession.id}`);
        continue;
      }

      if (input === "/history") {
        const messages = this.memory.getMessages(session.id);
        console.log(`\n=== 会话历史 (${messages.length} 条消息) ===`);
        for (const msg of messages) {
          console.log(`[${msg.role}]: ${msg.content.slice(0, 100)}`);
        }
        continue;
      }

      if (input === "/help") {
        console.log(`
可用命令：
  /new      - 创建新会话
  /history - 显示当前会话历史
  /exit    - 退出程序
  /help    - 显示帮助
`);
        continue;
      }

      try {
        const result = await this.agentLoop.run(input, session.id);
        console.log(`\nAgent: ${result}\n`);
      } catch (error) {
        console.error(`\n错误: ${error instanceof Error ? error.message : "未知错误"}\n`);
      }
    }

    this.rl.close();
  }

  private prompt(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer);
      });
    });
  }
}