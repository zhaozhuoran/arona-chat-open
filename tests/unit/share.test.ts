import test from "node:test";
import assert from "node:assert/strict";
import { ShareRepository } from "../../backend/src/repositories";

test("ShareRepository CRUD operations", async () => {
  const sharesMap = new Map<string, any>();
  const mockDb: any = {
    prepare: (sql: string) => {
      return {
        bind: (...args: any[]) => {
          return {
            all: async () => {
              if (sql.includes("SELECT token")) {
                const [sessionId, userId] = args;
                const results = Array.from(sharesMap.values()).filter(
                  (s) => s.session_id === sessionId && s.user_id === userId
                );
                return { results };
              }
              return { results: [] };
            },
            first: async () => {
              if (sql.includes("SELECT token")) {
                const [token] = args;
                return sharesMap.get(token) || null;
              }
              return null;
            },
            run: async () => {
              if (sql.includes("INSERT INTO chat_shares")) {
                const [token, sessionId, userId, allowAttachments, theme, expiresAt, createdAt, updatedAt] = args;
                sharesMap.set(token, {
                  token,
                  session_id: sessionId,
                  user_id: userId,
                  allow_attachments: allowAttachments,
                  theme,
                  expires_at: expiresAt,
                  created_at: createdAt,
                  updated_at: updatedAt,
                });
                return { success: true, meta: { changes: 1 } };
              }
              if (sql.includes("UPDATE chat_shares")) {
                const [allowAttachments, theme, expiresAt, updatedAt, token, userId] = args;
                const existing = sharesMap.get(token);
                if (existing && existing.user_id === userId) {
                  sharesMap.set(token, {
                    ...existing,
                    allow_attachments: allowAttachments,
                    theme,
                    expires_at: expiresAt,
                    updated_at: updatedAt,
                  });
                  return { success: true, meta: { changes: 1 } };
                }
                return { success: true, meta: { changes: 0 } };
              }
              if (sql.includes("DELETE FROM chat_shares")) {
                const [token, userId] = args;
                const existing = sharesMap.get(token);
                if (existing && existing.user_id === userId) {
                  sharesMap.delete(token);
                  return { success: true, meta: { changes: 1 } };
                }
                return { success: true, meta: { changes: 0 } };
              }
              return { success: true, meta: { changes: 0 } };
            },
          };
        },
      };
    },
  };

  const shareRepo = new ShareRepository(mockDb);

  // Create
  await shareRepo.createShare("tok123", "sess1", "user1", true, "ethereal-light", null, 1000);
  const found = await shareRepo.findShareByToken("tok123");
  assert.ok(found);
  assert.equal(found.token, "tok123");
  assert.equal(found.session_id, "sess1");
  assert.equal(found.user_id, "user1");
  assert.equal(found.allow_attachments, 1);
  assert.equal(found.theme, "ethereal-light");

  // List
  const list = await shareRepo.listSharesBySession("sess1", "user1");
  assert.equal(list.length, 1);
  assert.equal(list[0].token, "tok123");

  // Update
  const updated = await shareRepo.updateShare("tok123", "user1", false, "ethereal-dark", 2000, 1500);
  assert.equal(updated, true);
  const found2 = await shareRepo.findShareByToken("tok123");
  assert.equal(found2?.allow_attachments, 0);
  assert.equal(found2?.theme, "ethereal-dark");
  assert.equal(found2?.expires_at, 2000);

  // Delete
  const deleted = await shareRepo.deleteShare("tok123", "user1");
  assert.equal(deleted, true);
  const found3 = await shareRepo.findShareByToken("tok123");
  assert.equal(found3, null);
});
