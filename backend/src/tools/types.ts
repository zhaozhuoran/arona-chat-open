import { Env } from "../types";

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

export interface ToolHandler {
  definition: ToolDefinition;
  execute: (args: any, env: Env, context?: any) => Promise<string>;
}
