import { ChatOllama } from "@langchain/ollama";

const DEFAULT_MODEL = "qwen2.5";

export function getModel(): string {
  return process.env.MINI_CC_MODEL || DEFAULT_MODEL;
}

let llm: ChatOllama | null = null;

export function createLLM(): ChatOllama {
  if (!llm) {
    const baseUrl = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
    llm = new ChatOllama({
      model: getModel(),
      baseUrl,
    });
  }
  return llm;
}
