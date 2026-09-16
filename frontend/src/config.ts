export const API_URL = (typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_API_URL : undefined) || "http://localhost:8787";

export const BUILD_HASH = (typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_BUILD_HASH?.trim() : undefined) || "unknown";

export const BUILD_TIME = (typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_BUILD_TIME?.trim() : undefined) || "";

export const CLERK_PUBLISHABLE_KEY = (typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_CLERK_PUBLISHABLE_KEY : undefined) || "";

export const IS_CLERK_AVAILABLE = Boolean(CLERK_PUBLISHABLE_KEY);

export const PREVIEW_PASSWORD = (typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_PREVIEW_PASSWORD?.trim() : undefined) || "";

export const isPreviewAvailable = (): boolean => Boolean(PREVIEW_PASSWORD);

export const YEARCAKES_ACCOUNT_URL = (typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_YEARCAKES_ACCOUNT_URL : undefined) || "";

export const CLERK_USER_PROFILE_URL = (typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_CLERK_USER_PROFILE_URL : undefined) || "";

export const ACCOUNT_OR_PROFILE_URL = YEARCAKES_ACCOUNT_URL || CLERK_USER_PROFILE_URL;
