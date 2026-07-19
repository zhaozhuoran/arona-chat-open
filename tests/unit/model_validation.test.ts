import test from "node:test";
import assert from "node:assert";
import {
  isModelAllowed,
  resolveAiProvider,
  DEFAULT_MODEL,
  normalizeMaxOutputTokens,
} from "../../backend/src/backend-utils";

// Mock D1 Database
const createMockDb = (activeModels: string[]) => {
  return {
    prepare: (query: string) => {
      return {
        bind: (...params: any[]) => {
          return {
            first: async () => {
              const modelId = params[0];
              if (activeModels.includes(modelId)) {
                return { id: modelId, provider_id: "test-provider", name: "Test Model", input_usd_per_million: 1, output_usd_per_million: 1, is_active: 1 };
              }
              return null;
            }
          };
        }
      };
    }
  } as any;
};

test("normalizeMaxOutputTokens snaps to multiples of 1024 unless < 1024", () => {
  assert.strictEqual(normalizeMaxOutputTokens(undefined), 9216);
  assert.strictEqual(normalizeMaxOutputTokens(null), 1);
  assert.strictEqual(normalizeMaxOutputTokens(""), 1);
  assert.strictEqual(normalizeMaxOutputTokens("foo"), 9216);

  // values < 1024 are NOT snapped to multiples of 1024
  assert.strictEqual(normalizeMaxOutputTokens("1"), 1);
  assert.strictEqual(normalizeMaxOutputTokens("512"), 512);
  assert.strictEqual(normalizeMaxOutputTokens("1023"), 1023);

  // values >= 1024 are snapped to the nearest multiple of 1024
  assert.strictEqual(normalizeMaxOutputTokens("1024"), 1024);
  assert.strictEqual(normalizeMaxOutputTokens("1500"), 1024); // nearest to 1500 is 1024
  assert.strictEqual(normalizeMaxOutputTokens("1600"), 2048); // nearest to 1600 is 2048
  assert.strictEqual(normalizeMaxOutputTokens("10240"), 10240);
  assert.strictEqual(normalizeMaxOutputTokens("10500"), 10240); // 10 * 1024 = 10240
  assert.strictEqual(normalizeMaxOutputTokens("11000"), 11264); // 11 * 1024 = 11264
});

test("isModelAllowed identifies built-in and active custom models", async () => {
  const db = createMockDb(["custom-active-model"]);

  // Built-in models should be allowed
  assert.strictEqual(await isModelAllowed(db, "openai/gpt-5-mini"), true);
  assert.strictEqual(await isModelAllowed(db, DEFAULT_MODEL), true);

  // Active custom models should be allowed
  assert.strictEqual(await isModelAllowed(db, "custom-active-model"), true);

  // Inactive or random models should not be allowed
  assert.strictEqual(await isModelAllowed(db, "custom-inactive-model"), false);
  assert.strictEqual(await isModelAllowed(db, "random-arbitrary-model"), false);
  assert.strictEqual(await isModelAllowed(db, ""), false);
});

test("resolveAiProvider fallback restriction and active model resolution", async () => {
  const env = {
    D1_DB: {
      prepare: (query: string) => {
        return {
          bind: (...params: any[]) => {
            return {
              first: async () => {
                const modelId = params[0];
                if (modelId === "custom-model") {
                  return {
                    endpoint: "https://custom-provider.ai/api",
                    api_key_encrypted: null,
                    is_built_in: 1,
                    model_id: "custom-model",
                    name: "Custom Model",
                    input_usd_per_million: 1.5,
                    output_usd_per_million: 5.0,
                  };
                }
                return null;
              }
            };
          }
        };
      }
    } as any,
    AI_API_KEY: "test-api-key",
    API_ENDPOINT: "https://fallback.ai/api",
  } as any;

  const auth = { sub: "admin", isAdmin: true, canManageAi: true };

  // 1. Resolve an active database model
  const resolvedDbModel = await resolveAiProvider(env, "custom-model", auth);
  assert.strictEqual(resolvedDbModel.endpoint, "https://custom-provider.ai/api");
  assert.strictEqual(resolvedDbModel.apiKey, "test-api-key");
  assert.strictEqual(resolvedDbModel.modelName, "custom-model");
  assert.strictEqual(resolvedDbModel.isBuiltIn, true);

  // 2. Resolve a built-in default model using fallback
  const resolvedBuiltIn = await resolveAiProvider(env, "openai/gpt-5-mini", auth);
  assert.strictEqual(resolvedBuiltIn.endpoint, "https://fallback.ai/api");
  assert.strictEqual(resolvedBuiltIn.modelName, "openai/gpt-5-mini");
  assert.strictEqual(resolvedBuiltIn.isBuiltIn, true);

  // 3. Throw error when trying to fallback to an invalid arbitrary model
  await assert.rejects(
    async () => {
      await resolveAiProvider(env, "unauthorized/very-expensive-model", auth);
    },
    /Model unauthorized\/very-expensive-model is not active or not supported./
  );
});
