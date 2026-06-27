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
}
