export const DEFAULT_MODEL_DEFS: Array<{ id: string; name: string }> = [
  { id: "openai/gpt-5-mini", name: "OpenAI: GPT-5 Mini" },
  { id: "openai/gpt-5.5", name: "OpenAI: GPT-5.5" },
  { id: "openai/gpt-5.6-luna", name: "OpenAI: GPT-5.6 Luna" },
  { id: "openai/gpt-5.6-luna-pro", name: "OpenAI: GPT-5.6 Luna Pro" },
  { id: "openai/gpt-5.6-terra", name: "OpenAI: GPT-5.6 Terra" },
  { id: "openai/gpt-5.6-terra-pro", name: "OpenAI: GPT-5.6 Terra Pro" },
  { id: "openai/gpt-5.6-sol", name: "OpenAI: GPT-5.6 Sol" },
  { id: "openai/gpt-5.6-sol-pro", name: "OpenAI: GPT-5.6 Sol Pro" },
  { id: "openai/gpt-6-astra", name: "OpenAI: GPT-6 Astra" },
  { id: "openai/gpt-6-astra-pro", name: "OpenAI: GPT-6 Astra Pro" },

  { id: "google/gemini-3-flash-preview", name: "Google: Gemini 3 Flash Preview" },
  { id: "google/gemini-3.1-pro-preview", name: "Google: Gemini 3.1 Pro Preview" },
  { id: "google/gemini-3.5-flash", name: "Google: Gemini 3.5 Flash" },
  { id: "google/gemini-3.6-flash", name: "Google: Gemini 3.6 Flash" },

  { id: "anthropic/claude-sonnet-4.6", name: "Anthropic: Claude Sonnet 4.6" },
  { id: "anthropic/claude-opus-4.8", name: "Anthropic: Claude Opus 4.8" },
  { id: "anthropic/claude-opus-4.8-fast", name: "Anthropic: Claude Opus 4.8 (Fast)" },
  { id: "anthropic/claude-fable-5", name: "Anthropic: Claude Fable 5" },
];

export const MODELS_WITHOUT_REASONING: string[] = [
  "openai/gpt-5.6-luna-pro",
  "openai/gpt-5.6-terra-pro",
  "openai/gpt-5.6-sol-pro",
  "openai/gpt-6-astra-pro"
];

export const shouldExcludeReasoning = (
  modelId: string | null | undefined,
  modelName: string | null | undefined,
): boolean => {
  const normalizedId = modelId?.trim().toLowerCase();
  const normalizedName = modelName?.trim().toLowerCase();

  return MODELS_WITHOUT_REASONING.some((m) => {
    const normalizedTarget = m.toLowerCase();
    return (
      (normalizedId && normalizedId === normalizedTarget) ||
      (normalizedName && normalizedName === normalizedTarget)
    );
  });
};

export const DEFAULT_PRICING: Record<string, { input_usd_per_million: number; output_usd_per_million: number }> = {
  "openai/gpt-5-mini": { input_usd_per_million: 0.25, output_usd_per_million: 2.00 },
  "openai/gpt-5.5": { input_usd_per_million: 5.00, output_usd_per_million: 30.00 },
  "openai/gpt-5.5-pro": { input_usd_per_million: 30.00, output_usd_per_million: 180.00 },
  "openai/gpt-5.6-luna": { input_usd_per_million: 1.00, output_usd_per_million: 6.00 },
  "openai/gpt-5.6-luna-pro": { input_usd_per_million: 1.00, output_usd_per_million: 6.00 },
  "openai/gpt-5.6-terra": { input_usd_per_million: 2.50, output_usd_per_million: 15.00 },
  "openai/gpt-5.6-terra-pro": { input_usd_per_million: 2.50, output_usd_per_million: 15.00 },
  "openai/gpt-5.6-sol": { input_usd_per_million: 5.00, output_usd_per_million: 30.00 },
  "openai/gpt-5.6-sol-pro": { input_usd_per_million: 5.00, output_usd_per_million: 30.00 },
  "openai/gpt-6-astra": { input_usd_per_million: 10.00, output_usd_per_million: 50.00 },
  "openai/gpt-6-astra-pro": { input_usd_per_million: 10.00, output_usd_per_million: 50.00 },

  "google/gemini-3-flash-preview": { input_usd_per_million: 0.50, output_usd_per_million: 3.00 },
  "google/gemini-3.1-pro-preview": { input_usd_per_million: 2.00, output_usd_per_million: 12.00 },
  "google/gemini-3.5-flash": { input_usd_per_million: 1.50, output_usd_per_million: 9.00 },
  "google/gemini-3.6-flash": { input_usd_per_million: 1.50, output_usd_per_million: 7.50 },

  "anthropic/claude-sonnet-4.6": { input_usd_per_million: 3.00, output_usd_per_million: 15.00 },
  "anthropic/claude-opus-4.8": { input_usd_per_million: 5.00, output_usd_per_million: 25.00 },
  "anthropic/claude-opus-4.8-fast": { input_usd_per_million: 10.00, output_usd_per_million: 50.00 },
  "anthropic/claude-fable-5": { input_usd_per_million: 10.00, output_usd_per_million: 50.00 },

  "xiaomi/mimo-v2-pro": { input_usd_per_million: 1.00, output_usd_per_million: 3.00 },
  "qwen/qwen3-32b": { input_usd_per_million: 0.08, output_usd_per_million: 0.24 },
  "minimax/minimax-m2-her": { input_usd_per_million: 0.30, output_usd_per_million: 1.20 },
};
