import type { D1Database } from "@cloudflare/workers-types";
import type { AppContext } from "./backend-utils";
import type { Env } from "./types";
import { ensureDatabaseReady, resolveAiProvider } from "./backend-utils";

export interface UserLimitsStatus {
  enabled: boolean;
  max_daily_req: number;
  current_daily_req: number;
  max_storage_mb: number;
  current_storage_mb: number;
  max_single_file_mb: number;
}

/**
 * Helper to get configured single file size limit in bytes.
 * Defaults to 25MB if not specified.
 */
export const getSingleFileSizeLimitBytes = (env: Env): number => {
  let limitMB = Number(env.LIMIT_SINGLE_FILE_SIZE_MB);
  if (!Number.isFinite(limitMB) || limitMB <= 0) {
    limitMB = 25;
  }
  return limitMB * 1024 * 1024;
};

/**
 * Record API request log into SQLite.
 */
export const recordRequestLog = async (
  db: D1Database,
  userId: string,
  type: "chat" | "title",
  status: "success" | "failure",
): Promise<void> => {
  await db
    .prepare("INSERT INTO request_logs (id, user_id, type, status, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), userId, type, status, Date.now())
    .run();
};

/**
 * Resolve whether a model is served by a built-in provider.
 * Requests made with a user's own (self-added) provider are treated as
 * non-built-in so they bypass request-count limits.
 */
export const resolveModelBuiltIn = async (
  env: Env,
  modelId: string,
  auth: { sub: string; isAdmin: boolean; canManageAi: boolean },
): Promise<boolean> => {
  try {
    const resolution = await resolveAiProvider(env, modelId, auth);
    return resolution.isBuiltIn;
  } catch {
    // If the provider cannot be resolved we conservatively treat it as built-in
    // so that limit enforcement still applies.
    return true;
  }
};

/**
 * Check if the user/global request limits are exceeded.
 *
 * Requests made with a built-in model are subject to the per-user and global
 * daily request quotas. Requests made with a user's own provider (non built-in)
 * bypass these quotas entirely.
 */
export const checkRequestLimits = async (
  env: Env,
  userId: string,
  isAdmin: boolean,
  isBuiltIn: boolean,
): Promise<{ allowed: boolean; error?: string }> => {
  const enableLimits = env.ENABLE_USER_LIMITS === "1" || env.ENABLE_USER_LIMITS === "true";
  if (!enableLimits) {
    return { allowed: true };
  }

  // Requests made with a user's own provider bypass request-count limits.
  if (!isBuiltIn) {
    return { allowed: true };
  }

  // Admin bypass
  if (isAdmin || userId === "single-user") {
    return { allowed: true };
  }

  const db = env.D1_DB;
  const startOfDay = new Date().setUTCHours(0, 0, 0, 0);

  // Global limit check FIRST
  let globalLimit = Number(env.LIMIT_GLOBAL_DAILY_REQ);
  if (!Number.isFinite(globalLimit) || globalLimit <= 0) {
    globalLimit = 500;
  }
  const globalCountRow = await db
    .prepare("SELECT COUNT(*) as count FROM request_logs WHERE created_at >= ?")
    .bind(startOfDay)
    .first<{ count: number }>();
  if (Number(globalCountRow?.count ?? 0) >= globalLimit) {
    return { allowed: false, error: `Global daily request limit reached (${globalLimit} req/d).` };
  }

  // User limit
  let userLimit = Number(env.LIMIT_USER_DAILY_REQ);
  if (!Number.isFinite(userLimit) || userLimit <= 0) {
    userLimit = 50;
  }
  const userCountRow = await db
    .prepare("SELECT COUNT(*) as count FROM request_logs WHERE user_id = ? AND created_at >= ?")
    .bind(userId, startOfDay)
    .first<{ count: number }>();
  if (Number(userCountRow?.count ?? 0) >= userLimit) {
    return { allowed: false, error: `Daily request limit reached (${userLimit} req/d).` };
  }

  return { allowed: true };
};

/**
 * Check if the user attachment storage limit is exceeded.
 */
export const checkAttachmentLimits = async (
  c: AppContext,
  userId: string,
  isAdmin: boolean,
  newFileSize: number,
  excludeAttachmentId?: string,
  excludeLibraryFileId?: string,
): Promise<{ allowed: boolean; error?: string }> => {
  const env = c.env;
  const enableLimits = env.ENABLE_USER_LIMITS === "1" || env.ENABLE_USER_LIMITS === "true";
  if (!enableLimits) {
    return { allowed: true };
  }
  if (isAdmin || userId === "single-user") {
    return { allowed: true };
  }

  const db = env.D1_DB;
  let userLimitMB = Number(env.LIMIT_USER_ATTACHMENTS_MB);
  if (!Number.isFinite(userLimitMB) || userLimitMB <= 0) {
    userLimitMB = 100;
  }
  const userLimitBytes = userLimitMB * 1024 * 1024;

  const userTotalRow = await db
    .prepare(`
      SELECT (SELECT COALESCE(SUM(size), 0) FROM attachments WHERE user_id = ? AND status != 'deleted' AND id != ?) +
             (SELECT COALESCE(SUM(size), 0) FROM library_files WHERE user_id = ? AND status != 'deleted' AND id != ?) as total
    `)
    .bind(userId, excludeAttachmentId ?? "", userId, excludeLibraryFileId ?? "")
    .first<{ total: number | null }>();
  const currentTotal = Number(userTotalRow?.total ?? 0);

  if (currentTotal + newFileSize > userLimitBytes) {
    return { allowed: false, error: `Attachment limit reached (${userLimitMB}MB).` };
  }

  return { allowed: true };
};

/**
 * Retrieve current user quota vs limit usage statistics.
 */
export const getUserLimitsStatus = async (
  c: AppContext,
  userId: string,
  isAdmin: boolean,
): Promise<UserLimitsStatus> => {
  const env = c.env;
  const enabled = env.ENABLE_USER_LIMITS === "1" || env.ENABLE_USER_LIMITS === "true";

  let max_daily_req = Number(env.LIMIT_USER_DAILY_REQ);
  if (!Number.isFinite(max_daily_req) || max_daily_req <= 0) {
    max_daily_req = 50;
  }

  let max_storage_mb = Number(env.LIMIT_USER_ATTACHMENTS_MB);
  if (!Number.isFinite(max_storage_mb) || max_storage_mb <= 0) {
    max_storage_mb = 100;
  }

  let max_single_file_mb = Number(env.LIMIT_SINGLE_FILE_SIZE_MB);
  if (!Number.isFinite(max_single_file_mb) || max_single_file_mb <= 0) {
    max_single_file_mb = 25;
  }

  if (!enabled) {
    return {
      enabled: false,
      max_daily_req,
      current_daily_req: 0,
      max_storage_mb,
      current_storage_mb: 0,
      max_single_file_mb,
    };
  }

  const db = env.D1_DB;
  const startOfDay = new Date().setUTCHours(0, 0, 0, 0);

  // Current requests
  const userCountRow = await db
    .prepare("SELECT COUNT(*) as count FROM request_logs WHERE user_id = ? AND created_at >= ?")
    .bind(userId, startOfDay)
    .first<{ count: number }>();
  const current_daily_req = Number(userCountRow?.count ?? 0);

  // Current storage in MB (includes bytes reserved by in-flight upload sessions)
  const userTotalRow = await db
    .prepare(`
      SELECT (SELECT COALESCE(SUM(size), 0) FROM attachments WHERE user_id = ? AND status != 'deleted') +
             (SELECT COALESCE(SUM(size), 0) FROM library_files WHERE user_id = ? AND status != 'deleted') as total
    `)
    .bind(userId, userId)
    .first<{ total: number | null }>();
  const reservedRow = await db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN status = 'reserved' THEN size_reserved WHEN status = 'uploaded' THEN COALESCE(size_actual, size_reserved) ELSE 0 END), 0) as total
       FROM upload_sessions WHERE user_id = ? AND status IN ('reserved', 'uploaded')`,
    )
    .bind(userId)
    .first<{ total: number | null }>();
  const current_storage_bytes = Number(userTotalRow?.total ?? 0) + Number(reservedRow?.total ?? 0);
  const current_storage_mb = Number((current_storage_bytes / (1024 * 1024)).toFixed(2));

  return {
    enabled: true,
    max_daily_req,
    current_daily_req,
    max_storage_mb,
    current_storage_mb,
    max_single_file_mb,
  };
};

/**
 * Delete R2 objects + rows for upload sessions that expired (5min TTL) without
 * being confirmed. Expired sessions free their pre-occupied quota and any orphaned
 * R2 bytes.
 */
export const cleanupExpiredUploadSessions = async (env: Env): Promise<void> => {
  const now = Date.now();
  const rows = (
    await env.D1_DB.prepare(
      "SELECT id, object_key FROM upload_sessions WHERE expires_at < ? AND status != 'confirmed' AND status != 'deleted'",
    )
      .bind(now)
      .all<{ id: string; object_key: string }>()
  ).results ?? [];
  if (rows.length === 0) return;
  await Promise.all(rows.map((r) => env.R2_BUCKET.delete(r.object_key).catch(() => {})));
  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => "?").join(", ");
  await env.D1_DB.prepare(`UPDATE upload_sessions SET status = 'deleted', object_key = NULL WHERE id IN (${placeholders})`).bind(...ids).run();
};

/**
 * Convenience wrapper for request handlers that only have the Hono context.
 */
export const sweepExpiredUploadSessions = async (c: AppContext): Promise<void> => {
  await cleanupExpiredUploadSessions(c.env);
};

const getCurrentStorageBytes = async (db: D1Database, userId: string): Promise<number> => {
  const row = await db
    .prepare(
      `SELECT (SELECT COALESCE(SUM(size), 0) FROM attachments WHERE user_id = ? AND status != 'deleted') +
              (SELECT COALESCE(SUM(size), 0) FROM library_files WHERE user_id = ? AND status != 'deleted') as total`,
    )
    .bind(userId, userId)
    .first<{ total: number | null }>();
  return Number(row?.total ?? 0);
};

const getReservedUploadBytes = async (db: D1Database, userId: string): Promise<number> => {
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN status = 'reserved' THEN size_reserved WHEN status = 'uploaded' THEN COALESCE(size_actual, size_reserved) ELSE 0 END), 0) as total
       FROM upload_sessions WHERE user_id = ? AND status IN ('reserved', 'uploaded')`,
    )
    .bind(userId)
    .first<{ total: number | null }>();
  return Number(row?.total ?? 0);
};

/**
 * Reserve quota for a new upload session.
 *
 * Policy (per product decision): first free quota occupied by expired sessions,
 * then if still over the limit auto-delete the user's oldest confirmed
 * attachment/library files until the reservation fits. Avatars are exempt from
 * the bulk quota (only the 5MB single-file cap applies, enforced at upload).
 */
export const reserveUploadQuota = async (
  c: AppContext,
  userId: string,
  isAdmin: boolean,
  intendedType: string,
  sizeReserved: number,
  _conversationId?: string,
): Promise<{ allowed: boolean; error?: string }> => {
  const env = c.env;
  const enableLimits = env.ENABLE_USER_LIMITS === "1" || env.ENABLE_USER_LIMITS === "true";
  if (!enableLimits) {
    return { allowed: true };
  }
  if (isAdmin || userId === "single-user") {
    return { allowed: true };
  }
  if (intendedType === "avatar") {
    return { allowed: true };
  }

  // 1. Free quota occupied by expired sessions first.
  await sweepExpiredUploadSessions(c);

  let userLimitMB = Number(env.LIMIT_USER_ATTACHMENTS_MB);
  if (!Number.isFinite(userLimitMB) || userLimitMB <= 0) {
    userLimitMB = 100;
  }
  const userLimitBytes = userLimitMB * 1024 * 1024;

  let used = await getCurrentStorageBytes(env.D1_DB, userId);
  const reserved = await getReservedUploadBytes(env.D1_DB, userId);

  // 2. Auto-delete oldest confirmed files until the reservation fits.
  while (used + reserved + sizeReserved > userLimitBytes) {
    const oldest = await env.D1_DB
      .prepare(
        `SELECT 'attachments' AS src, id, size, r2_object_key FROM attachments WHERE user_id = ? AND status = 'active'
         UNION ALL
         SELECT 'library_files' AS src, id, size, r2_object_key FROM library_files WHERE user_id = ? AND status = 'active'
         ORDER BY created_at ASC LIMIT 1`,
      )
      .bind(userId, userId)
      .first<{ src: string; id: string; size: number; r2_object_key: string | null }>();
    if (!oldest) break;
    if (oldest.r2_object_key) {
      await env.R2_BUCKET.delete(oldest.r2_object_key).catch(() => {});
    }
    await env.D1_DB.prepare(`UPDATE ${oldest.src} SET status = 'deleted', r2_object_key = NULL WHERE id = ?`).bind(oldest.id).run();
    used -= Number(oldest.size || 0);
  }

  if (used + reserved + sizeReserved > userLimitBytes) {
    return { allowed: false, error: `Attachment limit reached (${userLimitMB}MB).` };
  }
  return { allowed: true };
};

/**
 * Execute cron cleanup task to purge stale attachments (older than TTL days) and
 * FIFO cleanup if global storage limit is exceeded.
 */
export const handleScheduledCleanup = async (env: Env): Promise<void> => {
  if (env.ENABLE_USER_LIMITS !== "1" && env.ENABLE_USER_LIMITS !== "true") {
    return;
  }
  await ensureDatabaseReady(env.D1_DB);
  await cleanupExpiredUploadSessions(env);

  // 1. Delete attachments older than TTL (default 7 days), excluding admins
  let ttlDays = Number(env.LIMIT_ATTACHMENT_TTL_DAYS);
  if (!Number.isFinite(ttlDays) || ttlDays <= 0) {
    ttlDays = 7;
  }
  const cutoff = Date.now() - ttlDays * 24 * 60 * 60 * 1000;

  const staleAttachments = (await env.D1_DB.prepare(`
    SELECT a.id, a.r2_object_key FROM attachments a
    LEFT JOIN profiles p ON a.user_id = p.user_id
    WHERE a.created_at < ? AND a.status != 'deleted'
    AND (p.is_admin IS NULL OR p.is_admin = 0)
    AND (a.user_id != 'single-user')
    LIMIT 100
  `).bind(cutoff).all()) as { results: Array<{ id: string; r2_object_key: string | null }> };

  const deletionPromises: Promise<void>[] = [];
  const staleIds: string[] = [];
  for (const row of (staleAttachments.results ?? [])) {
    if (row.r2_object_key) {
      deletionPromises.push(env.R2_BUCKET.delete(row.r2_object_key).catch(() => {}));
    }
    staleIds.push(row.id);
  }
  await Promise.all(deletionPromises);
  if (staleIds.length > 0) {
    const placeholders = staleIds.map(() => "?").join(", ");
    await env.D1_DB.prepare(`UPDATE attachments SET status = 'deleted', r2_object_key = NULL WHERE id IN (${placeholders})`).bind(...staleIds).run();
  }

  // 2. Global FIFO deletion if storage exceeds limit (default 5GB), excluding admins
  let globalLimitGB = Number(env.LIMIT_GLOBAL_ATTACHMENTS_GB);
  if (!Number.isFinite(globalLimitGB) || globalLimitGB <= 0) {
    globalLimitGB = 5;
  }
  const globalLimitBytes = globalLimitGB * 1024 * 1024 * 1024;

  const currentTotalRow = (await env.D1_DB.prepare("SELECT SUM(size) as total FROM attachments WHERE status != 'deleted'").first()) as { total: number | null } | null;
  let currentTotal = Number(currentTotalRow?.total ?? 0);

  if (currentTotal > globalLimitBytes) {
    // FIFO only considers non-admin files for deletion to meet the "bypass" requirement
    const candidates = (await env.D1_DB.prepare(`
      SELECT a.id, a.size, a.r2_object_key FROM attachments a
      LEFT JOIN profiles p ON a.user_id = p.user_id
      WHERE a.status != 'deleted'
      AND (p.is_admin IS NULL OR p.is_admin = 0)
      AND (a.user_id != 'single-user')
      ORDER BY a.created_at ASC
      LIMIT 100
    `).all()) as { results: Array<{ id: string; size: number; r2_object_key: string | null }> };

    const fifoDeletions: Promise<void>[] = [];
    const deletedIds: string[] = [];
    for (const row of (candidates.results ?? [])) {
      if (currentTotal <= globalLimitBytes) break;
      if (row.r2_object_key) {
        fifoDeletions.push(env.R2_BUCKET.delete(row.r2_object_key).catch(() => {}));
      }
      deletedIds.push(row.id);
      currentTotal -= Number(row.size || 0);
    }
    await Promise.all(fifoDeletions);
    if (deletedIds.length > 0) {
      const placeholders = deletedIds.map(() => "?").join(", ");
      await env.D1_DB.prepare(`UPDATE attachments SET status = 'deleted', r2_object_key = NULL WHERE id IN (${placeholders})`).bind(...deletedIds).run();
    }
  }
};
