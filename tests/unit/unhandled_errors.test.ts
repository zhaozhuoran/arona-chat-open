import test from "node:test";
import assert from "node:assert";
import { app } from "../../backend/src/backend-utils";
import "../../backend/src/routes-account";
import { requireAuth } from "../../backend/src/backend-utils";

// Define a test endpoint that always throws an unhandled error
app.get("/api/test-error-endpoint", async (c) => {
  const authorization = c.req.header("Authorization");
  if (authorization) {
    await requireAuth(c);
  }
  throw new Error("Sensitive internal database/key error detail");
});

const mockDb = {
  prepare: (query: string) => {
    const stmt = {
      bind: (...params: any[]) => stmt,
      run: async () => {
        return { success: true, meta: { changes: 1 } };
      },
      first: async () => {
        if (query.includes("schema_meta")) {
          return { version: 24 };
        }
        if (query.includes("FROM profiles") || query.includes("SELECT is_admin")) {
          return { is_admin: 1, can_manage_ai: 1, can_view_all_users: 1 };
        }
        return null;
      },
      all: async () => {
        return { results: [] };
      }
    };
    return stmt;
  }
} as any;

const env = {
  E2E_TEST: "1",
  E2E_TEST_TOKEN: "admin-test-token",
  AUTH_TOKEN_SECRET: "test-secret-at-least-thirty-two-chars-long",
  D1_DB: mockDb,
};

test("app.onError secure unhandled error masking for non-admin requests", async () => {
  const res = await app.request("/api/test-error-endpoint", {
    method: "GET",
  }, env);

  assert.strictEqual(res.status, 500);
  const data = await res.json() as any;
  // It should be masked with a generic message for non-admin/unauthenticated requests
  assert.strictEqual(data.error, "Internal server error.");
});

test("app.onError allows unmasked unhandled error details for admin requests", async () => {
  const res = await app.request("/api/test-error-endpoint", {
    method: "GET",
    headers: {
      "Authorization": "Bearer admin-test-token",
    },
  }, env);

  assert.strictEqual(res.status, 500);
  const data = await res.json() as any;
  // It should retain unmasked detailed error messages for administrators
  assert.strictEqual(data.error, "Sensitive internal database/key error detail");
});
