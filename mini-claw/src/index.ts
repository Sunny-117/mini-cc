import "dotenv/config";
import { Gateway } from "./gateway/Gateway.js";
import { Agent } from "./agent/Agent.js";
import { AgentLoop } from "./agent/AgentLoop.js";
import { MemoryStore } from "./memory/MemoryStore.js";
import { createDefaultToolRegistry } from "./tools/index.js";
import { AgentConfig } from "./types/index.js";

const config: AgentConfig = {
  model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  apiKey: process.env.OPENAI_API_KEY || "",
  baseURL: process.env.OPENAI_BASE_URL,
  maxTokens: 4096,
  temperature: 0.7,
  maxIterations: 10,
};

if (!config.apiKey) {
  console.error("错误: 请在 .env 文件中设置 OPENAI_API_KEY");
  console.error("参考 .env.example 文件");
  process.exit(1);
}

const toolRegistry = createDefaultToolRegistry();
const memory = new MemoryStore();

const agent = new Agent(config, toolRegistry);
const agentLoop = new AgentLoop(agent, memory);

const gateway = new Gateway(agentLoop, memory);
gateway.start().catch((error) => {
  console.error("启动失败:", error);
  process.exit(1);
});