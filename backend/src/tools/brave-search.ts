import { ToolHandler } from "./types";
import { Env } from "../types";

/**
 * Default values for Brave Search Tool
 */
const DEFAULT_COUNT = 5;
const DEFAULT_SAFE_SEARCH = "moderate";
const MAX_DESCRIPTION_LENGTH = 300;
export const braveSearchTool: ToolHandler = {
  definition: {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for real-time information, news, or specific topics.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query to look up (max 400 characters).",
          },
          count: {
            type: "number",
            description: "Number of results to return (max: 20).",
          },
          freshness: {
            type: "string",
// ... rest remains same

            description: "Filter by time (pd: 24h, pw: 7d, pm: 31d, py: 365d).",
            enum: ["pd", "pw", "pm", "py"],
          },
        },
        required: ["query"],
      },
    },
  },
  execute: async (args: any, env: Env, context?: any): Promise<string> => {
    const dynamicDefaultCount = context?.defaultCount ?? DEFAULT_COUNT;
    const { query, count = dynamicDefaultCount, freshness } = args;

    if (!query) {
      return "Error: Missing search query.";
    }

    const url = new URL(env.BRAVE_SEARCH_API_ENDPOINT);
    url.searchParams.set("q", query.slice(0, 400));
    url.searchParams.set("count", Math.min(20, Math.max(1, count)).toString());
    url.searchParams.set("safesearch", DEFAULT_SAFE_SEARCH);
    if (freshness) {
      url.searchParams.set("freshness", freshness);
    }

    try {
      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${env.BRAVE_SEARCH_API_TOKEN}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return `Error calling Search API: ${response.status} ${response.statusText}\n${errorText}`;
      }

      const data = (await response.json()) as any;
      const results = data?.web?.results;

      if (!results || !Array.isArray(results) || results.length === 0) {
        return "No results found for this query.";
      }

      const formattedResults = results.map((res: any, index: number) => {
        const title = res.title || "No Title";
        const link = res.url || "No URL";
        const description = (res.description || res.snippet || "No description available.")
          .slice(0, MAX_DESCRIPTION_LENGTH);
        
        return `${index + 1}. **${title}**\nURL: ${link}\nSnippet: ${description}`;
      }).join("\n\n");

      return `Search results for "${query}":\n\n${formattedResults}`;
    } catch (error) {
      return `Error executing web search: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
};
