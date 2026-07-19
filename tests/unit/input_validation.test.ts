import test from "node:test";
import assert from "node:assert";
import { app } from "../../backend/src/backend-utils";
import "../../backend/src/routes-account";

const mockDb = {
  prepare: (query: string) => {
    const stmt = {
      bind: (...params: any[]) => stmt,
      run: async () => {
        return { success: true, meta: { changes: 1 } };
      },
      first: async () => {
        if (query.includes("FROM ai_providers")) {
          return { id: "test-provider-id", owner_id: "single-user", is_built_in: 0, visibility: "private" };
        }
        if (query.includes("FROM ai_models")) {
          return { id: "test-model-id", owner_id: "single-user", is_built_in: 0 };
        }
        if (query.includes("FROM profiles") || query.includes("SELECT is_admin")) {
          return { is_admin: 1, can_manage_ai: 1, can_view_all_users: 1 };
        }
        if (query.includes("schema_meta")) {
          return { version: 22 };
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
  E2E_TEST_TOKEN: "test-token",
  AUTH_TOKEN_SECRET: "test-secret-at-least-thirty-two-chars-long",
  D1_DB: mockDb,
};

test("POST /api/settings/ai-providers validation rules", async () => {
  // Test non-string values
  const res0 = await app.request("/api/settings/ai-providers", {
    method: "POST",
    headers: {
      "Authorization": "Bearer test-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: 123,
      endpoint: "https://test-endpoint.com",
      api_key: "sk-test",
    }),
  }, env);
  assert.strictEqual(res0.status, 400);
  const data0 = await res0.json() as any;
  assert.strictEqual(data0.error, "name, endpoint, and api_key must be strings.");

  // Test name too long
  const res1 = await app.request("/api/settings/ai-providers", {
    method: "POST",
    headers: {
      "Authorization": "Bearer test-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "a".repeat(101),
      endpoint: "https://test-endpoint.com",
      api_key: "sk-test",
    }),
  }, env);
  assert.strictEqual(res1.status, 400);
  const data1 = await res1.json() as any;
  assert.strictEqual(data1.error, "Provider name must be <= 100 characters.");

  // Test endpoint too long
  const res2 = await app.request("/api/settings/ai-providers", {
    method: "POST",
    headers: {
      "Authorization": "Bearer test-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "Valid Name",
      endpoint: "https://" + "e".repeat(2048) + ".com",
      api_key: "sk-test",
    }),
  }, env);
  assert.strictEqual(res2.status, 400);
  const data2 = await res2.json() as any;
  assert.strictEqual(data2.error, "Provider endpoint must be <= 2048 characters.");

  // Test api_key too long
  const res3 = await app.request("/api/settings/ai-providers", {
    method: "POST",
    headers: {
      "Authorization": "Bearer test-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "Valid Name",
      endpoint: "https://valid.com",
      api_key: "k".repeat(2049),
    }),
  }, env);
  assert.strictEqual(res3.status, 400);
  const data3 = await res3.json() as any;
  assert.strictEqual(data3.error, "API key must be <= 2048 characters.");

  // Test valid payload
  const res4 = await app.request("/api/settings/ai-providers", {
    method: "POST",
    headers: {
      "Authorization": "Bearer test-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "Valid Name",
      endpoint: "https://valid.com",
      api_key: "valid-api-key",
    }),
  }, env);
  assert.strictEqual(res4.status, 200);
  const data4 = await res4.json() as any;
  assert.strictEqual(data4.success, true);
});

test("PUT /api/settings/ai-providers/:id validation rules", async () => {
  // Test non-string name
  const res0 = await app.request("/api/settings/ai-providers/test-id", {
    method: "PUT",
    headers: {
      "Authorization": "Bearer test-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: 123,
    }),
  }, env);
  assert.strictEqual(res0.status, 400);
  const data0 = await res0.json() as any;
  assert.strictEqual(data0.error, "Provider name must be a string.");

  // Test name too long
  const res1 = await app.request("/api/settings/ai-providers/test-id", {
    method: "PUT",
    headers: {
      "Authorization": "Bearer test-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "a".repeat(101),
    }),
  }, env);
  assert.strictEqual(res1.status, 400);
  const data1 = await res1.json() as any;
  assert.strictEqual(data1.error, "Provider name must be <= 100 characters.");

  // Test empty name
  const res2 = await app.request("/api/settings/ai-providers/test-id", {
    method: "PUT",
    headers: {
      "Authorization": "Bearer test-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "   ",
    }),
  }, env);
  assert.strictEqual(res2.status, 400);
  const data2 = await res2.json() as any;
  assert.strictEqual(data2.error, "Provider name cannot be empty.");
});

test("POST /api/settings/ai-models validation rules", async () => {
  // Test non-string body params
  const res0 = await app.request("/api/settings/ai-models", {
    method: "POST",
    headers: {
      "Authorization": "Bearer test-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      provider_id: 123,
      model_id: "test-model",
      name: "Test Model Name",
    }),
  }, env);
  assert.strictEqual(res0.status, 400);
  const data0 = await res0.json() as any;
  assert.strictEqual(data0.error, "provider_id, model_id, and name must be strings.");

  // Test invalid input pricing
  const res1 = await app.request("/api/settings/ai-models", {
    method: "POST",
    headers: {
      "Authorization": "Bearer test-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      provider_id: "test-provider",
      model_id: "test-model",
      name: "Test Model Name",
      input_usd_per_million: -1,
    }),
  }, env);
  assert.strictEqual(res1.status, 400);
  const data1 = await res1.json() as any;
  assert.strictEqual(data1.error, "Invalid input pricing value. Must be a finite non-negative number <= 100,000.");

  // Test model_id too long
  const res2 = await app.request("/api/settings/ai-models", {
    method: "POST",
    headers: {
      "Authorization": "Bearer test-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      provider_id: "test-provider",
      model_id: "m".repeat(257),
      name: "Test Model Name",
    }),
  }, env);
  assert.strictEqual(res2.status, 400);
  const data2 = await res2.json() as any;
  assert.strictEqual(data2.error, "Model ID must be <= 256 characters.");
});
