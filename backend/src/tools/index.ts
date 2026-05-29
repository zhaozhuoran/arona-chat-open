import { ToolHandler } from "./types";
import { braveSearchTool } from "./brave-search";

export const TOOLS: Record<string, ToolHandler> = {
  [braveSearchTool.definition.function.name]: braveSearchTool,
};

export function getAvailableTools() {
  return Object.values(TOOLS).map((t) => t.definition);
}
