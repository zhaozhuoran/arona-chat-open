# Environment Variables Reference (ENV.md)

This document contains a comprehensive, exhaustive reference of all environment variables supported by Arona Chat across the frontend and backend.

---

## Table of Contents
1. [Backend Environment Variables (Backend - Cloudflare Workers Secrets & Vars)](#1-backend-environment-variables-backend---cloudflare-workers-secrets--vars)
   - [AI Core Service & Model Provider Configuration](#ai-core-service--model-provider-configuration)
   - [Security, Encryption & Authentication](#security-encryption--authentication)
   - [Access Control & Whitelist](#access-control--whitelist)
   - [Resource Limits & Storage Quota](#resource-limits--storage-quota)
   - [S3 / Cloudflare R2 Storage Configuration](#s3--cloudflare-r2-storage-configuration)
   - [Web Search Integration (Web Search Tool)](#web-search-integration-web-search-tool)
   - [Testing & E2E Validation Environment Variables](#testing--e2e-validation-environment-variables)
   - [System Default User Preferences](#system-default-user-preferences)
2. [Backend Resource Bindings](#2-backend-resource-bindings)
3. [Frontend Environment Variables (Frontend - React + Vite)](#3-frontend-environment-variables-frontend---react--vite)

---

## 1. Backend Environment Variables (Backend - Cloudflare Workers Secrets & Vars)

### AI Core Service & Model Provider Configuration

#### `AI_API_KEY`
* **Type**: `string` (Secret)
* **Required**: Yes (if using the built-in large-model provider)
* **Default**: -
* **Example**: `sk-or-v1-abc123xyz456...`
* **Values**: Any valid API key string for an OpenRouter- or OpenAI-compatible provider
* **Description**: The primary API key for the built-in default AI model service (e.g. OpenRouter).
* **Used By**:
  - `resolveAiProvider` function in `backend/src/backend-utils.ts`

#### `API_ENDPOINT`
* **Type**: `string` (URL)
* **Required**: No
* **Default**: `https://openrouter.ai/api/v1/chat/completions`
* **Example**: `https://api.deepseek.com/v1/chat/completions`
* **Values**: Any RFC-compliant `https://` API endpoint that passes the `assertSafeEndpoint` security validation
* **Description**: The base Completions API endpoint used for the built-in large-model provider.
* **Used By**:
  - `resolveAiProvider` function in `backend/src/backend-utils.ts`

#### `MODEL_PRICING_JSON`
* **Type**: `string` (JSON String)
* **Required**: No
* **Default**: `null` (uses the system's built-in default pricing)
* **Example**: `{"openai/gpt-4o":{"input":2.5,"output":10},"deepseek/deepseek-chat":{"input":0.14,"output":0.28}}`
* **Values**: A correctly formatted JSON dictionary string where each key is a model ID (in the form `provider/model-name`) and each value must be a JSON object containing `input` and `output` (or `prompt` and `completion`) floating-point prices in USD per million tokens.
* **Description**: Pricing override for built-in or custom models.
* **Used By**:
  - `getModelPricing` / `resolveModelPricingOverride` functions in `backend/src/backend-utils.ts`

#### `SYSTEM_PROMPT_SETTING`
* **Type**: `string`
* **Required**: No
* **Default**: `null`
* **Example**: `You are Arona, the main AI assistant operating SCHALE Terminal. Keep answers concise.`
* **Values**: Any text string
* **Description**: A custom system prompt prefix injected at the very front of every conversation's system prompt.
* **Used By**:
  - `buildInjectedSystemPrompt` function in `backend/src/backend-utils.ts`

#### `SHOW_UPSTREAM_ERROR_TO_USERS`
* **Type**: `string` (`"1"` | `"true"` | `"0"` | `"false"`)
* **Required**: No
* **Default**: `false`
* **Example**: `1`
* **Values**: `"1"`, `"true"`, `"0"`, `"false"`
* **Description**: Whether to allow unmasked, full raw upstream AI API error details to be returned and shown to non-admin (regular) users.
* **Used By**:
  - The `runJob` exception handling block in `backend/src/chat-session-durable-object.ts`

---

### Security, Encryption & Authentication

#### `AUTH_TOKEN_SECRET`
* **Type**: `string` (Secret)
* **Required**: Yes
* **Default**: -
* **Example**: `d7ca8e219fb0a29318ef...`
* **Values**: Recommended to be at least a 32-character, high-entropy, strongly random string
* **Description**: The master symmetric encryption and hashing key for the entire backend. Used to derive the JWT signing sub-key, the end-to-end symmetric encryption sub-key for user-custom model API keys, and the temporary URL signing key for file hotlink/anti-tampering protection.
* **Used By**:
  - `getAuthSecret`, `deriveHkdfKey`, `encryptApiKey`, `decryptApiKey` functions in `backend/src/backend-utils.ts`

#### `CLERK_SECRET_KEY`
* **Type**: `string` (Secret)
* **Required**: Yes (if Clerk unified authentication is enabled)
* **Default**: -
* **Example**: `sk_test_51Mz...`
* **Values**: The private token string provided by Clerk for the backend
* **Description**: The private key for Clerk's unified identity verification backend, used to decode and validate the Bearer JWT tokens passed in from the frontend.
* **Used By**:
  - `verifyClerkToken` function in `backend/src/auth-utils.ts`

#### `CLERK_PUBLISHABLE_KEY`
* **Type**: `string` (Secret)
* **Required**: Yes (must be configured on both the frontend and backend for matching/verification)
* **Default**: -
* **Example**: `pk_test_clerk...`
* **Values**: Clerk's frontend public Publishable Key string
* **Description**: Clerk's frontend access credential. The backend reads this configuration as a secondary comparison basis for multi-environment token validation.
* **Used By**:
  - `verifyClerkToken` function in `backend/src/auth-utils.ts`

#### `USERS_ADMIN_EMAILS`
* **Type**: `string` (Comma-separated)
* **Required**: Yes
* **Default**: -
* **Example**: `sensei@schale.co,arona@schale.co`
* **Values**: A comma-separated (`,`) collection of correctly formatted email addresses
* **Description**: The global system administrator email allowlist. Users with an email in this list are automatically flagged as `is_admin = 1` after completing Clerk login, granting administrator privileges (ability to modify built-in models, allocate budgets, and add public providers).
* **Used By**:
  - `getAdminEmails`, `verifyUserAuthentication` functions in `backend/src/backend-utils.ts`

---

### Access Control & Whitelist

#### `ENABLE_WHITELIST`
* **Type**: `string` (`"1"` | `"true"` | `"0"` | `"false"`)
* **Required**: No
* **Default**: `false`
* **Example**: `true`
* **Values**: `"1"`, `"true"`, `"0"`, `"false"`
* **Description**: Whether to enable the platform's registration and access whitelist policy. When enabled, only emails listed in `WHITELIST_EMAILS` or `USERS_ADMIN_EMAILS` are permitted.
* **Used By**:
  - `verifyUserAuthentication` function in `backend/src/backend-utils.ts`

#### `WHITELIST_EMAILS`
* **Type**: `string` (Comma-separated)
* **Required**: No (required when `ENABLE_WHITELIST=1`)
* **Default**: -
* **Example**: `student1@kivotos.edu,student2@kivotos.edu`
* **Values**: A comma-separated (`,`) list of valid emails
* **Description**: The allowlist of regular user emails permitted to register and use the platform.
* **Used By**:
  - `verifyUserAuthentication` function in `backend/src/backend-utils.ts`

#### `DEV_ADMIN_SHARE_CHAT`
* **Type**: `string` (`"1"` | `"true"` | `"0"` | `"false"`)
* **Required**: No
* **Default**: `false`
* **Example**: `true`
* **Values**: `"1"`, `"true"`, `"0"`, `"false"`
* **Description**: Used in development or multi-admin tenant testing environments. When enabled, all users flagged as Admins are force-mapped to the `'single-user'` identifier, so that multiple people share exactly the same conversation and settings lists.
* **Used By**:
  - `verifyUserAuthentication` function in `backend/src/backend-utils.ts`

#### `DEV_ENABLE_PASSKEY_AUTH`
* **Type**: `string` (`"1"` | `"true"` | `"0"` | `"false"`)
* **Required**: No
* **Default**: `false`
* **Example**: `false`
* **Values**: `"1"`, `"true"`, `"0"`, `"false"`
* **Description**: Whether to allow the deprecated legacy local Passkey/local password registration authentication system. Should always be `false` in production.
* **Used By**:
  - `isPasskeyAuthEnabled` function in `backend/src/backend-utils.ts`

---

### Resource Limits & Storage Quota

#### `ENABLE_USER_LIMITS`
* **Type**: `string` (`"1"` | `"true"` | `"0"` | `"false"`)
* **Required**: No
* **Default**: `false`
* **Example**: `true`
* **Values**: `"1"`, `"true"`, `"0"`, `"false"`
* **Description**: Whether to enable the quota and limits enforcement module for regular users. If set to `true`, the `LIMIT_*` variables below take effect for non-admin accounts.
* **Used By**:
  - `checkRequestLimits`, `checkAttachmentLimits`, `getUserLimitsStatus` and other functions in `backend/src/resource-limits.ts`

#### `LIMIT_ATTACHMENT_TTL_DAYS`
* **Type**: `number`
* **Required**: No
* **Default**: `7`
* **Example**: `14`
* **Values**: Any positive integer
* **Description**: The retention period in days for user-uploaded chat attachments and files within the system. After expiry they are garbage-collected (the R2 entity is automatically deleted and the D1 status is marked as expired).
* **Used By**:
  - `cleanupStaleAttachments` function in `backend/src/resource-limits.ts`

#### `LIMIT_USER_ATTACHMENTS_MB`
* **Type**: `number`
* **Required**: No
* **Default**: `100`
* **Example**: `500`
* **Values**: Any positive number
* **Description**: The maximum cumulative attachment storage quota per regular user (in MB).
* **Used By**:
  - `checkAttachmentLimits`, `getUserLimitsStatus` functions in `backend/src/resource-limits.ts`

#### `LIMIT_GLOBAL_ATTACHMENTS_GB`
* **Type**: `number`
* **Required**: No
* **Default**: `5`
* **Example**: `50`
* **Values**: Any positive number
* **Description**: The total R2 storage capacity threshold (in GB) that the entire platform is allowed to occupy. When exceeded, the automatic cleanup process evicts stale user files using FIFO (first-in-first-out) logic.
* **Used By**:
  - `cleanupStaleAttachments` function in `backend/src/resource-limits.ts`

#### `LIMIT_USER_DAILY_REQ`
* **Type**: `number`
* **Required**: No
* **Default**: `50`
* **Example**: `100`
* **Values**: Any positive integer
* **Description**: The maximum number of daily (UTC) requests a regular user is allowed to make to the built-in models.
* **Used By**:
  - `checkRequestLimits`, `getUserLimitsStatus` functions in `backend/src/resource-limits.ts`

#### `LIMIT_GLOBAL_DAILY_REQ`
* **Type**: `number`
* **Required**: No
* **Default**: `500`
* **Example**: `5000`
* **Values**: Any positive integer
* **Description**: The total maximum number of daily requests across all regular users allowed to the built-in models.
* **Used By**:
  - `checkRequestLimits` function in `backend/src/resource-limits.ts`

#### `LIMIT_SINGLE_FILE_SIZE_MB`
* **Type**: `number`
* **Required**: No
* **Default**: `25`
* **Example**: `50`
* **Values**: Any positive integer
* **Description**: The maximum size limit for a single uploaded attachment or library file (in MB).
* **Used By**:
  - `getSingleFileSizeLimitBytes` function in `backend/src/resource-limits.ts`
  - The presign and finalize validation checkpoints in `backend/src/routes-storage.ts`

---

### S3 / Cloudflare R2 Storage Configuration

#### `R2_ACCESS_KEY_ID`
* **Type**: `string` (Secret)
* **Required**: Yes
* **Default**: -
* **Example**: `ca8971f1e98a3b8da7df...`
* **Values**: The HMAC S3 Access Key ID derived from Cloudflare API R2 credentials
* **Description**: The access key ID required by the AWS S3-compatible R2 bucket read/write client.
* **Used By**:
  - `getR2ClientConfig` function in `backend/src/backend-utils.ts`

#### `R2_SECRET_ACCESS_KEY`
* **Type**: `string` (Secret)
* **Required**: Yes
* **Default**: -
* **Example**: `789abcde0012398fa2cb...`
* **Values**: The HMAC S3 Secret Access Key derived from Cloudflare API R2 credentials
* **Description**: The secret encryption key required by the AWS S3-compatible R2 bucket read/write client.
* **Used By**:
  - `getR2ClientConfig` function in `backend/src/backend-utils.ts`

#### `R2_ENDPOINT`
* **Type**: `string` (URL)
* **Required**: Yes
* **Default**: -
* **Example**: `https://abcd987efc123.r2.cloudflarestorage.com`
* **Values**: An https domain link conforming to the AWS S3 endpoint format
* **Description**: The dedicated API root connection endpoint for your Cloudflare R2 account.
* **Used By**:
  - `getR2Endpoint` function in `backend/src/backend-utils.ts`

#### `R2_PUBLIC_BASE_URL`
* **Type**: `string` (URL)
* **Required**: No (highly recommended for the lowest image/avatar loading latency)
* **Default**: `null` (without this, reads are proxied through the Worker path)
* **Example**: `https://pub-r2.arona-chat.com`
* **Values**: A public multi-domain binding for the R2 bucket or a Cloudflare custom-resolved URL
* **Description**: The CDN root for the public read-only R2 bucket. Once configured, when loading and displaying images and user avatars in chats, the system skips the Worker read and directly redirects or caches to this CDN path.
* **Used By**:
  - `toAbsoluteUrl` / `toAbsoluteUrlPublic` functions in `backend/src/backend-utils.ts`

#### `R2_PROXY_DOMAIN`
* **Type**: `string` (Host/Domain)
* **Required**: No
* **Default**: `null`
* **Example**: `proxy-r2.arona-chat.com`
* **Values**: A valid second- or third-level domain, without protocol or path
* **Description**: The dedicated file signed-forwarding proxy gateway domain.
* **Used By**:
  - `buildSignedFileProxyPath`, `verifyModelFileUrlSignature` functions in `backend/src/backend-utils.ts`

---

### Web Search Integration (Web Search Tool)

#### `BRAVE_SEARCH_API_ENDPOINT`
* **Type**: `string` (URL)
* **Required**: No (if AI-assisted web search is not needed)
* **Default**: `https://api.search.brave.com/res/v1/web/search`
* **Example**: `https://api.search.brave.com/res/v1/web/search`
* **Values**: A valid http/https URL endpoint
* **Description**: The Brave Search service endpoint.
* **Used By**:
  - `executeBraveSearch` function in `backend/src/tools/brave-search.ts`

#### `BRAVE_SEARCH_API_TOKEN`
* **Type**: `string` (Secret)
* **Required**: No (if the web tool is not enabled)
* **Default**: -
* **Example**: `BS_abc123token`
* **Values**: The Brave Search API Key authorization credential string
* **Description**: The dedicated authorization token secret for the Brave Search API.
* **Used By**:
  - `executeBraveSearch` function in `backend/src/tools/brave-search.ts`

---

### Testing & E2E Validation Environment Variables

#### `E2E_TEST`
* **Type**: `string` (`"1"` | `"true"` | `"0"` | `"false"`)
* **Required**: No (for testing or automated scripts only)
* **Default**: `false`
* **Example**: `1`
* **Values**: `"1"`, `"true"`, `"0"`, `"false"`
* **Description**: Flags whether the system is currently in an E2E test run. When enabled, the system allows private or Localhost local link ports to be connected at `/api/settings/ai-providers`, exempting SSRF redirect validation to assist local testing and integration.
* **Used By**:
  - `assertSafeEndpoint` security filter function in `backend/src/backend-utils.ts`
  - `verifyUserAuthentication` function in `backend/src/backend-utils.ts`

#### `E2E_TEST_TOKEN`
* **Type**: `string` (Secret)
* **Required**: No
* **Default**: -
* **Example**: `super-mock-admin-auth-token-1234`
* **Values**: Any arbitrary string
* **Description**: A static token in the test environment that directly bypasses Clerk OAuth enforcement. Carried in the Header, it immediately identifies the caller as a specific administrator identity, used for automated black-box and white-box API validation.
* **Used By**:
  - `verifyUserAuthentication` function in `backend/src/backend-utils.ts`

---

### System Default User Preferences

#### `DEFAULT_EL_STREAMING_STYLE`
* **Type**: `string` (`"typewriter"` | `"buffered"`)
* **Required**: No
* **Default**: `typewriter`
* **Example**: `buffered`
* **Values**: `"typewriter"`, `"buffered"`
* **Description**: Configures the default rendering style returned by the system under the Ethereal Light modern theme for newly registered/default users, or when no SSE rendering preference is set in the database. `typewriter` enables a character-by-character typewriter animation; `buffered` enables block-buffered output rendering with smooth color gradients.
* **Used By**:
  - `readProfile` function in `backend/src/backend-utils.ts`
  - The backend validation module for user profile updates in `backend/src/routes-account.ts`

---

## 2. Backend Resource Bindings

Cloudflare Workers native resources bound in `wrangler.toml`, accessed in code directly via `c.env.xxx` for RPC or connection read/write:

| Binding Name | Binding Type | Description |
| :--- | :--- | :--- |
| `D1_DB` | `D1 Database` | The SQLite relational database storing user information, conversation content, system settings, and built-in model definitions. |
| `CHAT_SESSION_DO` | `Durable Objects` | Manages multi-user long-connection transactions, and provides smooth cached replay and reconnection recovery for the streaming SSE protocol. |
| `R2_BUCKET` | `R2 Storage Bucket` | The Cloudflare R2 storage bucket entity, used to store users' personal custom avatars and chat-uploaded attachment files. |

---

## 3. Frontend Environment Variables (Frontend - React + Vite)

The frontend is bundled with Vite. All environment variables exposed to the browser and user-facing state must have the `VITE_` prefix.

#### `VITE_API_URL`
* **Type**: `string` (URL)
* **Required**: No
* **Default**: `http://localhost:8787`
* **Example**: `https://api.arona-chat.com`
* **Values**: Any correctly formatted running address of the backend Hono Worker
* **Description**: Tells the frontend which API endpoint to target for REST API interactions or to create long polling.
* **Used By**:
  - The top-level API_URL resolution constant in `frontend/src/store/useStore.ts`

#### `VITE_CLERK_PUBLISHABLE_KEY`
* **Type**: `string`
* **Required**: Yes (if using online OAuth login and session validation)
* **Default**: -
* **Example**: `pk_live_abcdefg...`
* **Values**: The public Publishable Key provided by Clerk
* **Description**: The public access credential required for the frontend to load, instantiate, and sign into the Clerk account manager.
* **Used By**:
  - The Clerk initialization sections in `frontend/src/App.tsx`, `frontend/src/main.tsx`, and `frontend/src/store/useStore.ts`

#### `VITE_PREVIEW_PASSWORD`
* **Type**: `string` (Secret/Plain)
* **Required**: No (only needed when compiling a standalone static Preview demo site without a backend)
* **Default**: -
* **Example**: `test-preview-password`
* **Values**: Any non-empty plain text string
* **Description**: Static demo bypass password. If configured, the bundler compiles mock user information, sample conversation data, etc. into the static package at build time, allowing it to present a basic visual interface for review without the Hono/D1 backend and Clerk backend.
* **Used By**:
  - The `isPreviewAvailable` state checks in `frontend/src/App.tsx`, `frontend/src/main.tsx`, and `frontend/src/store/useStore.ts`

#### `VITE_YEARCAKES_ACCOUNT_URL`
* **Type**: `string` (URL)
* **Required**: No
* **Default**: -
* **Example**: `https://accounts.yearcakes.com`
* **Values**: A valid URL address
* **Description**: Guides users to a specific external site or custom SSO account management page to modify their own account information.
* **Used By**:
  - `frontend/src/components/SettingsPanel.tsx`

#### `VITE_CLERK_USER_PROFILE_URL`
* **Type**: `string` (URL)
* **Required**: No
* **Default**: -
* **Example**: `https://clerk-profile.my-app.net`
* **Values**: A valid URL address
* **Description**: A fallback redirection page used when `VITE_YEARCAKES_ACCOUNT_URL` is missing, guiding users to Clerk's self-service profile panel.
* **Used By**:
  - `frontend/src/components/SettingsPanel.tsx`

#### `VITE_BUILD_HASH`
* **Type**: `string`
* **Required**: No (can be auto-generated and appended at build time by the build script)
* **Default**: `"unknown"`
* **Example**: `7bc90ab`
* **Values**: Any short Git Commit Hash string
* **Description**: The injected version hash, displayed in the frontend "Settings -> Info" footer for debugging and troubleshooting.
* **Used By**:
  - `frontend/src/components/SettingsPanel.tsx`

#### `VITE_BUILD_TIME`
* **Type**: `string`
* **Required**: No (can be appended by the build script)
* **Default**: `""`
* **Example**: `2026-07-18T21:45:00Z`
* **Values**: A time text value
* **Description**: The timestamp at build time.
* **Used By**:
  - `frontend/src/components/SettingsPanel.tsx`
