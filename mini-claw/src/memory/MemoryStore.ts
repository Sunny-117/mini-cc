import { Message, Session } from "../types/index.js";

interface SummaryChunk {
  id: string;
  sessionId: string;
  startIndex: number;
  endIndex: number;
  content: string;
  createdAt: Date;
}

interface SemanticMemoryItem {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  messageIndex: number;
  embedding: number[];
  createdAt: Date;
}

interface MemoryStoreOptions {
  storageDir?: string;
  shortTermWindowSize?: number;
  summaryBatchSize?: number;
  summaryKeepRecent?: number;
  summaryMaxChunksInContext?: number;
  semanticTopK?: number;
  semanticMaxItemsPerSession?: number;
  semanticMaxCharsPerItem?: number;
}

const DEFAULT_OPTIONS: Required<MemoryStoreOptions> = {
  storageDir: "./sessions",
  shortTermWindowSize: 12,
  summaryBatchSize: 8,
  summaryKeepRecent: 12,
  summaryMaxChunksInContext: 3,
  semanticTopK: 3,
  semanticMaxItemsPerSession: 400,
  semanticMaxCharsPerItem: 240,
};

export class MemoryStore {
  private sessions: Map<string, Session> = new Map();
  private currentSessionId: string | null = null;
  private storageDir: string;
  private options: Required<MemoryStoreOptions>;

  private summaries: Map<string, SummaryChunk[]> = new Map();
  private summaryCursor: Map<string, number> = new Map();
  private pendingSummarySessions: Set<string> = new Set();
  private summaryWorkerRunning = false;

  private semanticMemories: Map<string, SemanticMemoryItem[]> = new Map();

  constructor(options: MemoryStoreOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.storageDir = this.options.storageDir;
  }

  generateSessionId(): string {
    return `session_${Date.now()}`;
  }

  createSession(): Session {
    const session: Session = {
      id: this.generateSessionId(),
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.sessions.set(session.id, session);
    this.currentSessionId = session.id;

    this.summaries.set(session.id, []);
    this.summaryCursor.set(session.id, 0);
    this.semanticMemories.set(session.id, []);

    return session;
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  getCurrentSession(): Session | undefined {
    if (!this.currentSessionId) return undefined;
    return this.sessions.get(this.currentSessionId);
  }

  setCurrentSession(sessionId: string): void {
    if (this.sessions.has(sessionId)) {
      this.currentSessionId = sessionId;
    }
  }

  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  getOrCreateSession(): Session {
    if (this.currentSessionId) {
      const session = this.sessions.get(this.currentSessionId);
      if (session) return session;
    }
    return this.createSession();
  }

  addMessage(sessionId: string, message: Message): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.messages.push(message);
    session.updatedAt = new Date();

    if (message.role === "user" || message.role === "assistant") {
      const messageIndex = session.messages.length - 1;
      this.addSemanticMemory(sessionId, message.role, message.content, messageIndex);
    }

    this.scheduleSummaryForSession(sessionId);
  }

  appendTurn(sessionId: string, userInput: string, assistantOutput: string): void {
    this.addMessage(sessionId, { role: "user", content: userInput });
    this.addMessage(sessionId, { role: "assistant", content: assistantOutput });
  }

  async buildContextMessages(sessionId: string, currentInput: string): Promise<Message[]> {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    const shortTerm = this.getShortTermMessages(session);
    const summaryContext = this.getSummaryContext(sessionId);
    const semanticContext = this.getSemanticContext(sessionId, currentInput);

    const memorySections: string[] = [];
    if (summaryContext.length > 0) {
      memorySections.push("【中期摘要记忆】\n" + summaryContext.map((s, i) => `${i + 1}. ${s}`).join("\n"));
    }
    if (semanticContext.length > 0) {
      memorySections.push(
        "【长期语义记忆（向量召回）】\n" +
          semanticContext.map((s, i) => `${i + 1}. ${s}`).join("\n"),
      );
    }

    if (memorySections.length === 0) {
      return shortTerm;
    }

    return [
      {
        role: "system",
        content: `以下是为当前问题动态构建的记忆上下文，请按需使用并避免与短期对话重复：\n\n${memorySections.join(
          "\n\n",
        )}`,
      },
      ...shortTerm,
    ];
  }

  getMessages(sessionId: string): Message[] {
    const session = this.sessions.get(sessionId);
    return session?.messages || [];
  }

  getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  deleteSession(sessionId: string): boolean {
    this.summaries.delete(sessionId);
    this.summaryCursor.delete(sessionId);
    this.pendingSummarySessions.delete(sessionId);
    this.semanticMemories.delete(sessionId);

    if (this.currentSessionId === sessionId) {
      this.currentSessionId = null;
    }
    return this.sessions.delete(sessionId);
  }

  clearAllSessions(): void {
    this.sessions.clear();
    this.currentSessionId = null;
    this.summaries.clear();
    this.summaryCursor.clear();
    this.pendingSummarySessions.clear();
    this.semanticMemories.clear();
  }

  private getShortTermMessages(session: Session): Message[] {
    const windowSize = this.options.shortTermWindowSize;
    if (session.messages.length <= windowSize) {
      return [...session.messages];
    }
    return session.messages.slice(-windowSize);
  }

  private getSummaryContext(sessionId: string): string[] {
    const chunks = this.summaries.get(sessionId) || [];
    const maxChunks = this.options.summaryMaxChunksInContext;
    return chunks.slice(-maxChunks).map((c) => c.content);
  }

  private getSemanticContext(sessionId: string, query: string): string[] {
    const memories = this.semanticMemories.get(sessionId) || [];
    if (memories.length === 0 || !query.trim()) return [];

    const queryEmbedding = this.createEmbedding(query);
    const topK = this.options.semanticTopK;

    const scored = memories
      .map((item) => ({
        item,
        score: this.cosineSimilarity(queryEmbedding, item.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .filter((x) => x.score > 0.15);

    return scored.map((x) => `${x.item.role === "user" ? "用户" : "助手"}: ${x.item.content}`);
  }

  private addSemanticMemory(
    sessionId: string,
    role: "user" | "assistant",
    content: string,
    messageIndex: number,
  ): void {
    const normalized = content.trim();
    if (!normalized) return;

    const maxChars = this.options.semanticMaxCharsPerItem;
    const clipped = normalized.length > maxChars ? `${normalized.slice(0, maxChars)}...` : normalized;

    const bucket = this.semanticMemories.get(sessionId) || [];
    bucket.push({
      id: `sem_${sessionId}_${Date.now()}_${messageIndex}`,
      sessionId,
      role,
      content: clipped,
      messageIndex,
      embedding: this.createEmbedding(clipped),
      createdAt: new Date(),
    });

    const maxItems = this.options.semanticMaxItemsPerSession;
    if (bucket.length > maxItems) {
      bucket.splice(0, bucket.length - maxItems);
    }

    this.semanticMemories.set(sessionId, bucket);
  }

  private scheduleSummaryForSession(sessionId: string): void {
    this.pendingSummarySessions.add(sessionId);
    if (this.summaryWorkerRunning) return;

    this.summaryWorkerRunning = true;
    setTimeout(() => {
      void this.runSummaryWorker();
    }, 0);
  }

  private async runSummaryWorker(): Promise<void> {
    try {
      while (this.pendingSummarySessions.size > 0) {
        const sessionId = this.pendingSummarySessions.values().next().value as string;
        this.pendingSummarySessions.delete(sessionId);
        await this.generateIncrementalSummary(sessionId);
      }
    } finally {
      this.summaryWorkerRunning = false;
      if (this.pendingSummarySessions.size > 0) {
        this.scheduleSummaryForSession(
          this.pendingSummarySessions.values().next().value as string,
        );
      }
    }
  }

  private async generateIncrementalSummary(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const keepRecent = this.options.summaryKeepRecent;
    const batchSize = this.options.summaryBatchSize;
    let cursor = this.summaryCursor.get(sessionId) || 0;

    const summaryUpperBound = Math.max(0, session.messages.length - keepRecent);
    while (cursor + batchSize <= summaryUpperBound) {
      const start = cursor;
      const end = cursor + batchSize;
      const slice = session.messages.slice(start, end);
      const content = this.summarizeMessages(slice);

      if (content) {
        const chunks = this.summaries.get(sessionId) || [];
        chunks.push({
          id: `sum_${sessionId}_${Date.now()}_${start}_${end}`,
          sessionId,
          startIndex: start,
          endIndex: end,
          content,
          createdAt: new Date(),
        });
        this.summaries.set(sessionId, chunks);
      }

      cursor = end;
      this.summaryCursor.set(sessionId, cursor);
    }
  }

  private summarizeMessages(messages: Message[]): string {
    const lines: string[] = [];
    for (const message of messages) {
      if (message.role !== "user" && message.role !== "assistant") {
        continue;
      }
      const prefix = message.role === "user" ? "用户" : "助手";
      const normalized = message.content.replace(/\s+/g, " ").trim();
      if (!normalized) continue;
      lines.push(`${prefix}: ${normalized.slice(0, 120)}`);
    }
    if (lines.length === 0) return "";
    return lines.join(" | ");
  }

  private createEmbedding(text: string): number[] {
    const dim = 128;
    const vector = new Array<number>(dim).fill(0);
    const tokens = text.toLowerCase().split(/[^a-z0-9\u4e00-\u9fa5]+/).filter(Boolean);
    if (tokens.length === 0) {
      return vector;
    }

    for (const token of tokens) {
      let h = 2166136261;
      for (let i = 0; i < token.length; i++) {
        h ^= token.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      const idx = Math.abs(h) % dim;
      vector[idx] += 1;
    }

    const norm = Math.sqrt(vector.reduce((sum, x) => sum + x * x, 0));
    if (norm === 0) return vector;
    return vector.map((x) => x / norm);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
    }
    return dot;
  }
}
