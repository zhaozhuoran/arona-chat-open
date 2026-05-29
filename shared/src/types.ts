export interface Session {
  id: string;
  title: string;
  created_at: number;
  archived_at: number | null;
  pinned_at: number | null;
}

export interface Workspace {
  id: string;
  name: string;
  archived_at: number | null;
  created_at: number;
  updated_at: number;
}

export const SYSTEM_PROMPT_TIMEZONE_OPTIONS = [
  { value: "UTC", label: "UTC" },
  { value: "Asia/Shanghai", label: "UTC+8 (Beijing, China)" },
  { value: "Asia/Tokyo", label: "UTC+9 (Tokyo, Japan)" },
  { value: "America/Los_Angeles", label: "UTC-8/-7 (Los Angeles, USA)" },
] as const;

export interface Message {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  attachments?: MessageAttachment[];
  created_at: number;
  model?: string | null;
  reasoning_summary?: string | null;
}

export type MessageAttachmentType = "image" | "audio" | "video" | "file";

export interface MessageAttachment {
  id: string;
  file_name: string;
  mime_type: string;
  size: number;
  url: string;
  type: MessageAttachmentType;
}

export interface Attachment {
  id: string;
  file_hash: string;
  file_name: string;
  mime_type: string;
  size: number;
  r2_url: string;
  r2_object_key?: string | null;
  access_url?: string | null;
  created_at: number;
}

export interface UserProfile {
  username: string;
  avatar_key: string | null;
  avatar_url: string | null;
  dynamic_background: boolean;
  send_shortcut: "ctrl_enter" | "enter";
  conversation_library_enabled: boolean;
  updated_at: number;
}

export type ReasoningEffort = "minimal" | "low" | "medium" | "high" | "xhigh";
export type LogLevel = "INFO" | "TRACE";

export interface ChatGenerationSettings {
  reasoning_effort: ReasoningEffort;
  max_output_tokens: number;
  daily_budget_usd: number;
  web_search_enabled: boolean;
  web_search_max_results: number;
}

export interface DailyBudgetStatus {
  date_utc: string;
  budget_usd: number;
  spent_usd: number;
  remaining_usd: number;
  selected_model_output_usd_per_million: number | null;
  available_output_tokens: number | null;
}

export interface PasskeyInfo {
  id: string;
  nickname: string | null;
  device_type: string;
  backed_up: boolean;
  transports: string[];
  created_at: number;
  last_used_at: number | null;
}

export interface PasskeyConfig {
  rp_name: string;
  rp_id: string;
  origin: string;
}

export interface ModelPricing {
  input_usd_per_million: number;
  output_usd_per_million: number;
}

export interface ModelOption {
  id: string;
  name: string;
  pricing: ModelPricing | null;
}

export interface UsageModelBreakdown {
  model: string;
  requests: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
}

export interface UsageSummary {
  total_requests: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  total_cost_usd: number;
  by_model: UsageModelBreakdown[];
}
