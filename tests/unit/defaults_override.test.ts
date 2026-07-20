import test from "node:test";
import assert from "node:assert";
import { readProfile } from "../../backend/src/backend-utils";

test("readProfile default theme and streaming style fallbacks and env override", async () => {
  let queryTheme: string | null = null;
  let queryStyle: string | null = null;

  const mockDb = {
    prepare: (query: string) => {
      if (query.includes("profiles WHERE user_id = ?")) {
        return {
          bind: (userId: string) => ({
            first: async () => ({
              username: "Sensei",
              avatar_key: null,
              avatar_url_cache: null,
              avatar_url_cache_expires_at: null,
              dynamic_background: 1,
              theme: queryTheme,
              arona_bubble_style: "none",
              ethereal_streaming_style: queryStyle,
              send_shortcut: "ctrl_enter",
              conversation_library_enabled: 1,
              updated_at: Date.now(),
              total_requests: 0,
              total_prompt_tokens: 0,
              total_completion_tokens: 0,
              total_tokens: 0,
              total_cost_usd: 0,
              usage_by_model_json: "[]",
            }),
          }),
        };
      }
      return {
        bind: () => ({
          run: async () => ({ success: true }),
        }),
      } as any;
    },
  } as any;

  // Case 1: Database fields are NULL and no environment override is present
  const context1 = {
    env: {
      D1_DB: mockDb,
    },
  } as any;

  queryTheme = null;
  queryStyle = null;

  const profile1 = await readProfile(context1, "user-123");
  assert.strictEqual(profile1.theme, "ethereal-light");
  assert.strictEqual(profile1.ethereal_streaming_style, "typewriter");

  // Case 2: Database fields are NULL but DEFAULT_EL_STREAMING_STYLE env override is set to 'buffered'
  const context2 = {
    env: {
      D1_DB: mockDb,
      DEFAULT_EL_STREAMING_STYLE: "buffered",
    },
  } as any;

  const profile2 = await readProfile(context2, "user-123");
  assert.strictEqual(profile2.theme, "ethereal-light");
  assert.strictEqual(profile2.ethereal_streaming_style, "buffered");

  // Case 3: Database has explicit user preferences which must be respected (Option A)
  const context3 = {
    env: {
      D1_DB: mockDb,
      DEFAULT_EL_STREAMING_STYLE: "typewriter", // fallback is typewriter
    },
  } as any;

  // User has explicitly set theme to 'standard' and streaming style to 'buffered'
  queryTheme = "standard";
  queryStyle = "buffered";

  const profile3 = await readProfile(context3, "user-123");
  assert.strictEqual(profile3.theme, "standard");
  assert.strictEqual(profile3.ethereal_streaming_style, "buffered");

  // Case 4: Database theme is NULL and DEFAULT_THEME env override is set to 'standard'
  const context4 = {
    env: {
      D1_DB: mockDb,
      DEFAULT_THEME: "standard",
    },
  } as any;

  queryTheme = null;

  const profile4 = await readProfile(context4, "user-123");
  assert.strictEqual(profile4.theme, "standard");

  // Case 5: Database theme is NULL and DEFAULT_THEME env override is set to 'ethereal-light'
  const context5 = {
    env: {
      D1_DB: mockDb,
      DEFAULT_THEME: "ethereal-light",
    },
  } as any;

  const profile5 = await readProfile(context5, "user-123");
  assert.strictEqual(profile5.theme, "ethereal-light");
});
