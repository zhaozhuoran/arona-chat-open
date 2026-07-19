import test from "node:test";
import assert from "node:assert";
import { MODELS_WITHOUT_REASONING, shouldExcludeReasoning } from "../../backend/src/backend-utils";

test("MODELS_WITHOUT_REASONING list contains expected models", () => {
  assert.ok(Array.isArray(MODELS_WITHOUT_REASONING), "Should be an array");
  assert.deepStrictEqual(MODELS_WITHOUT_REASONING, [
    "openai/gpt-5.6-luna-pro",
    "openai/gpt-5.6-terra-pro",
    "openai/gpt-5.6-sol-pro"
  ]);
});

test("shouldExcludeReasoning helper logic works with exact case, case-insensitivity, and fallback cases", () => {
  // Exact matches
  assert.strictEqual(shouldExcludeReasoning("openai/gpt-5.6-luna-pro", "openai/gpt-5.6-luna-pro"), true);
  assert.strictEqual(shouldExcludeReasoning("openai/gpt-5.6-terra-pro", "openai/gpt-5.6-terra-pro"), true);
  assert.strictEqual(shouldExcludeReasoning("openai/gpt-5.6-sol-pro", "openai/gpt-5.6-sol-pro"), true);

  // Case-insensitive matches
  assert.strictEqual(shouldExcludeReasoning("OPENAI/GPT-5.6-LUNA-PRO", "openai/gpt-5.6-luna-pro"), true);
  assert.strictEqual(shouldExcludeReasoning("openai/gpt-5.6-luna-pro", "OPENAI/GPT-5.6-LUNA-PRO"), true);
  assert.strictEqual(shouldExcludeReasoning("OpenAI/Gpt-5.6-Sol-Pro", "OpenAI/Gpt-5.6-Sol-Pro"), true);

  // Non-excluded models
  assert.strictEqual(shouldExcludeReasoning("openai/gpt-5.6-luna", "openai/gpt-5.6-luna"), false);
  assert.strictEqual(shouldExcludeReasoning("openai/gpt-5-mini", "openai/gpt-5-mini"), false);

  // Undefined or null checks
  assert.strictEqual(shouldExcludeReasoning(undefined, undefined), false);
  assert.strictEqual(shouldExcludeReasoning(null, null), false);
  assert.strictEqual(shouldExcludeReasoning("openai/gpt-5.6-luna-pro", null), true);
  assert.strictEqual(shouldExcludeReasoning(null, "openai/gpt-5.6-sol-pro"), true);
});
