export interface Env {
  D1_DB: D1Database;
  R2_BUCKET: R2Bucket;
  CHAT_SESSION_DO: DurableObjectNamespace;
  API_ENDPOINT: string;
  AI_API_KEY: string;
  BRAVE_SEARCH_API_ENDPOINT: string;
  BRAVE_SEARCH_API_TOKEN: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_ENDPOINT: string;
  AUTH_PASSWORD?: string;
  AUTH_TOKEN_SECRET?: string;
  CLERK_SECRET_KEY?: string;
  CLERK_PUBLISHABLE_KEY?: string;
  USERS_ADMIN_EMAILS?: string;
  R2_PUBLIC_BASE_URL?: string;
  R2_PROXY_DOMAIN?: string;
  MODEL_PRICING_JSON?: string;
  SYSTEM_PROMPT_SETTING?: string;
  BACKEND_BUILD_HASH?: string;
  BACKEND_BUILD_TIME?: string;

  // Access Control & Whitelist
  ENABLE_WHITELIST?: string;
  WHITELIST_EMAILS?: string;

  // Resource Limits
  ENABLE_USER_LIMITS?: string;
  ADMIN_BYPASS_LIMITS?: string;
  LIMIT_ATTACHMENT_TTL_DAYS?: string;
  LIMIT_USER_ATTACHMENTS_MB?: string;
  LIMIT_GLOBAL_ATTACHMENTS_GB?: string;
  LIMIT_USER_DAILY_REQ?: string;
  LIMIT_GLOBAL_DAILY_REQ?: string;
  LIMIT_SINGLE_FILE_SIZE_MB?: string;

  // Compatibility & Features
  DEV_ADMIN_SHARE_CHAT?: string;
  SHOW_UPSTREAM_ERROR_TO_USERS?: string;

  // Legacy local-session / passkey auth. Disabled by default; only re-enabled
  // for local development via this flag (never set in production).
  DEV_ENABLE_PASSKEY_AUTH?: string;

  // E2E Test
  E2E_TEST?: string;
  E2E_TEST_TOKEN?: string;

  // System default user preference overrides
  DEFAULT_THEME?: string;
  DEFAULT_EL_STREAMING_STYLE?: string;
}
