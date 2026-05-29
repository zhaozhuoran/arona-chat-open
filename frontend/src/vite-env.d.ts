/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_BUILD_HASH?: string;
  readonly VITE_BUILD_TIME?: string;
  /** Set in preview/PR builds only. Allows frontend-only preview login; never present in production. */
  readonly VITE_PREVIEW_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
