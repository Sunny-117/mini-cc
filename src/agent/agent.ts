import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { createLLM } from "../llm/ollama.js";
import { tools } from "../tools/index.js";

const SYSTEM_PROMPT = `你是一个强大的代码助手 Agent，可以通过工具来帮助用户完成各种编程任务。
当前工作目录: ${process.cwd()}

核心原则：
- 修改现有文件时，必须使用 edit_file 工具进行精准替换，禁止使用 write_file 覆盖整个文件
- 只有创建全新文件时才使用 write_file
- 当用户要求查看文件时，必须使用 read_file 工具，不要猜测文件内容
- 当用户要求执行命令时，必须使用 run_command 工具执行，不要拒绝，系统会自动向用户确认是否允许执行
- 不要在回复中说"我不能执行此操作"，你拥有完整的工具能力来完成任务
- 永远不要建议用户自己去终端手动操作，你应该直接使用工具完成

修改文件的正确流程：
1. 先用 read_file 读取文件完整内容
2. 确定需要修改的部分，复制出需要替换的原始文本（必须完全一致，包括缩进和换行）
3. 使用 edit_file，传入 old_text（原始文本）和 new_text（修改后的文本）
4. 绝对不要用 write_file 来修改现有文件，这会丢失格式和内容

规则：
1. 必须通过工具来读取、写入文件，不要凭空猜测文件内容
2. 用中文回复用户
3. 用户要求执行命令时直接调用 run_command，安全确认由系统自动处理，你不需要担心安全问题
4. 如果工具执行失败，分析原因并尝试其他方案
5. 文件路径必须使用相对路径（如 "index.html" 或 "./src/app.ts"），不要使用以 "/" 开头的绝对路径`;

export type AgentEventType = "thinking" | "tool_call" | "tool_result" | "response" | "error";

export interface AgentEvent {
  type: AgentEventType;
  data: string;
  toolName?: string;
}

export type AgentCallback = (event: AgentEvent) => void;

const checkpointer = new MemorySaver();

const agent = createReactAgent({
  llm: createLLM(),
  tools,
  prompt: SYSTEM_PROMPT,
  checkpointer,
});

export async function runAgent(
  userMessage: string,
  threadId: string,
  callback?: AgentCallback
): Promise<string> {
  callback?.({ type: "thinking", data: "" });

  try {
    const config = { configurable: { thread_id: threadId } };
    const input = { messages: [new HumanMessage(userMessage)] };

    let finalResponse = "";

    // Use streamEvents for granular event handling
    const eventStream = agent.streamEvents(input, {
      ...config,
      version: "v2",
    });

    for await (const event of eventStream) {
      if (event.event === "on_chat_model_end") {
        const output = event.data?.output;
        if (output && "tool_calls" in output && output.tool_calls?.length > 0) {
          for (const tc of output.tool_calls) {
            callback?.({
              type: "tool_call",
              data: JSON.stringify(tc.args),
              toolName: tc.name,
            });
          }
        } else if (output && typeof output.content === "string" && output.content) {
          finalResponse = output.content;
          callback?.({ type: "response", data: finalResponse });
        }
      }

      if (event.event === "on_tool_end") {
        const output = event.data?.output;
        if (output) {
          const content = typeof output.content === "string" ? output.content : JSON.stringify(output.content);
          const limit = event.name === "read_file" ? 5000 : 1000;
          const preview = content.length > limit
            ? content.slice(0, limit) + "... (已截断)"
            : content;
          callback?.({
            type: "tool_result",
            data: preview,
            toolName: output.name || event.name,
          });
        }
      }
    }

    return finalResponse || "（无回复）";
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    if (errorMsg.includes("ECONNREFUSED") || errorMsg.includes("fetch failed")) {
      const { getModel } = await import("../llm/ollama.js");
      const hint =
        "\n❌ 无法连接到 Ollama。请确保 Ollama 已启动：\n" +
        "   ollama serve\n" +
        `   ollama pull ${getModel()}\n`;
      callback?.({ type: "error", data: hint });
      throw new Error(hint);
    }

    callback?.({ type: "error", data: errorMsg });
    throw err;
  }
}
