import test from "node:test";
import assert from "node:assert";
import {
  checkRequestLimits,
  resolveModelBuiltIn,
  DEFAULT_MODEL,
  encryptApiKey,
} from "../../backend/src/backend-utils";

// Mock D1 Database that returns a configurable request count.
const createMockDb = (globalCount: number, userCount: number) => {
  return {
    prepare: (query: string) => {
      return {
        bind: (...params: any[]) => {
          return {
            first: async () => {
              // The global query has a single bind param (startOfDay);
              // the user query has two (userId, startOfDay).
              if (params.length >= 2) {
                return { count: userCount };
              }
              return { count: globalCount };
            },
          };
        },
      };
    },
  } as any;
};

const createMockEnv = (overrides: Record<string, any> = {}) => {
  return {
    ENABLE_USER_LIMITS: "1",
    LIMIT_GLOBAL_DAILY_REQ: "500",
    LIMIT_USER_DAILY_REQ: "50",
    D1_DB: createMockDb(0, 0),
    ...overrides,
  } as any;
};

test("checkRequestLimits: disabled limits always allowed", async () => {
  const env = createMockEnv({ ENABLE_USER_LIMITS: "0", D1_DB: createMockDb(9999, 9999) });
  const result = await checkRequestLimits(env, "user-1", false, true);
  assert.strictEqual(result.allowed, true);
});

test("checkRequestLimits: built-in under limits is allowed", async () => {
  const env = createMockEnv();
  const result = await checkRequestLimits(env, "user-1", false, true);
  assert.strictEqual(result.allowed, true);
});

test("checkRequestLimits: built-in over user limit is blocked", async () => {
  const env = createMockEnv({ D1_DB: createMockDb(0, 50) });
  const result = await checkRequestLimits(env, "user-1", false, true);
  assert.strictEqual(result.allowed, false);
  assert.match(result.error ?? "", /Daily request limit reached/);
});

test("checkRequestLimits: built-in over global limit is blocked", async () => {
  const env = createMockEnv({ D1_DB: createMockDb(500, 0) });
  const result = await checkRequestLimits(env, "user-1", false, true);
  assert.strictEqual(result.allowed, false);
  assert.match(result.error ?? "", /Global daily request limit reached/);
});

test("checkRequestLimits: self-added (non built-in) model bypasses limits", async () => {
  const env = createMockEnv({ D1_DB: createMockDb(9999, 9999) });
  const result = await checkRequestLimits(env, "user-1", false, false);
  assert.strictEqual(result.allowed, true);
});

test("checkRequestLimits: admin always allowed", async () => {
  const env = createMockEnv({ D1_DB: createMockDb(9999, 9999) });
  const result = await checkRequestLimits(env, "admin-1", true, true);
  assert.strictEqual(result.allowed, true);
});

test("resolveModelBuiltIn: built-in model returns true", async () => {
  const result = await resolveModelBuiltIn(createMockEnv(), DEFAULT_MODEL, {
    sub: "user-1",
    isAdmin: false,
    canManageAi: false,
  });
  assert.strictEqual(result, true);
});

test("resolveModelBuiltIn: custom provider model returns false", async () => {
  const secret = "my_very_long_mock_auth_token_secret_32_chars_or_more";
  const dummyEnv = { AUTH_TOKEN_SECRET: secret } as any;
  const encryptedKey = await encryptApiKey(dummyEnv, "dummy-api-key");

  const db = {
    prepare: () => ({
      bind: () => ({
        first: async () => ({
          id: "custom-1",
          is_built_in: 0,
          owner_id: "user-1",
          visibility: "private",
          endpoint: "https://safe-endpoint.ai/v1",
          api_key_encrypted: encryptedKey,
        }),
      }),
    }),
  } as any;
  const result = await resolveModelBuiltIn(
    { ...createMockEnv(), AUTH_TOKEN_SECRET: secret, D1_DB: db },
    "custom-1",
    { sub: "user-1", isAdmin: false, canManageAi: false },
  );
  assert.strictEqual(result, false);
});
