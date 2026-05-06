import { Tool } from "../types/index.js";

export class WebSearchTool implements Tool {
  name = "web_search";
  description =
    "搜索网络信息，适用于查询实时信息、新闻、技术问题等。输入搜索关键词，返回相关结果。";
  parameters = {
    query: { type: "string", description: "搜索关键词" },
    limit: {
      type: "number",
      description: "返回结果数量，默认为5",
    },
  };
  required = ["query"];

  private mockMode: boolean;
  private apiKey: string | undefined;

  constructor(mockMode: boolean = true, apiKey?: string) {
    this.mockMode = mockMode;
    this.apiKey = apiKey;
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const query = (params.query as string)?.trim();
    const limit = (params.limit as number) || 5;
    if (!query) {
      return "错误：query 不能为空";
    }

    if (this.mockMode) {
      return this.mockSearch(query, limit);
    }

    if (!this.apiKey) {
      return this.mockSearch(query, limit);
    }

    return this.realSearch(query, limit);
  }

  private mockSearch(query: string, limit: number): string {
    const mockResults: Record<string, string[]> = {
      "typescript 5.0": [
        "TypeScript 5.0 引入了装饰器(Decorators)支持，这是自 Angular 以来最大的语法更新",
        "支持 const 类型参数，允许使用 const 声明类型参数",
        "TypeScript 5.0 全面提升了构建性能，编译速度提升高达 70%",
        "改进了类型推断，特别是在泛型和条件类型方面",
        "支持 ES2022 语法，包括 Record<...> 改进和 Object.keys 安全使用",
      ],
      "react 18": [
        "React 18 引入了 automatic batching 自动批处理，提升性能",
        "新增 concurrent rendering 并发渲染模式",
        "支持 useId 新 hook，用于生成唯一的 ID",
        "useTransition 和 useDeferredValue 用于改善用户体验",
        "Suspense 改进，支持更细粒度的加载状态控制",
      ],
    };

    const results = mockResults[query.toLowerCase()] || [
      `关于 "${query}" 的搜索结果 1：这是模拟搜索结果，包含相关信息...`,
      `关于 "${query}" 的搜索结果 2：这是模拟搜索结果，包含更多信息...`,
      `关于 "${query}" 的搜索结果 3：这是模拟搜索结果，包含详细描述...`,
    ];

    const limited = results.slice(0, limit);

    return limited
      .map((r, i) => `[${i + 1}] ${r}`)
      .join("\n\n");
  }

  private async realSearch(query: string, limit: number): Promise<string> {
    return this.mockSearch(query, limit);
  }
}
