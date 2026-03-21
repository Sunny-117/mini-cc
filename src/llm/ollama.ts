import { Ollama, type Message } from "ollama";

const DEFAULT_MODEL = "deepseek-r1";

export function getModel(): string {
  return process.env.MINI_CC_MODEL || DEFAULT_MODEL;
}

let client: Ollama | null = null;

function getClient(): Ollama {
  if (!client) {
    const host = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
    client = new Ollama({ host });
  }
  return client;
}

export interface ChatOptions {
  model?: string;
  messages: Message[];
}

export async function chat(options: ChatOptions): Promise<string> {
  const model = options.model || getModel();
  try {
    const response = await getClient().chat({
      model,
      messages: options.messages,
      stream: false,
    });
    return response.message.content;
  } catch (err: unknown) {
    handleOllamaError(err);
    throw err;
  }
}

export async function* chatStream(
  options: ChatOptions
): AsyncGenerator<string, void, unknown> {
  const model = options.model || getModel();
  try {
    const stream = await getClient().chat({
      model,
      messages: options.messages,
      stream: true,
    });
    for await (const chunk of stream) {
      yield chunk.message.content;
    }
  } catch (err: unknown) {
    handleOllamaError(err);
    throw err;
  }
}

function handleOllamaError(err: unknown): void {
  if (err instanceof Error) {
    if (
      err.message.includes("ECONNREFUSED") ||
      err.message.includes("fetch failed")
    ) {
      console.error(
        "\n❌ 无法连接到 Ollama。请确保 Ollama 已启动：\n" +
          "   ollama serve\n" +
          `   ollama pull ${getModel()}\n`
      );
    }
  }
}
