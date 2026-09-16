import test from "node:test";
import assert from "node:assert";
import {
  normalizeImageCompressionEnabled,
  normalizeImageMaxDimension,
} from "../../backend/src/backend-utils";

test("normalizeImageCompressionEnabled handles defaults and boolean string values", () => {
  assert.strictEqual(normalizeImageCompressionEnabled(undefined), true);
  assert.strictEqual(normalizeImageCompressionEnabled(null), true);
  assert.strictEqual(normalizeImageCompressionEnabled("1"), true);
  assert.strictEqual(normalizeImageCompressionEnabled("true"), true);
  assert.strictEqual(normalizeImageCompressionEnabled("TRUE"), true);
  assert.strictEqual(normalizeImageCompressionEnabled("0"), false);
  assert.strictEqual(normalizeImageCompressionEnabled("false"), false);
  assert.strictEqual(normalizeImageCompressionEnabled("FALSE"), false);
});

test("normalizeImageMaxDimension validates and clamps dimension options", () => {
  assert.strictEqual(normalizeImageMaxDimension(undefined), 2048);
  assert.strictEqual(normalizeImageMaxDimension(null), 2048);
  assert.strictEqual(normalizeImageMaxDimension(""), 2048);
  assert.strictEqual(normalizeImageMaxDimension("1024"), 1024);
  assert.strictEqual(normalizeImageMaxDimension("1536"), 1536);
  assert.strictEqual(normalizeImageMaxDimension("2048"), 2048);
  assert.strictEqual(normalizeImageMaxDimension("4096"), 4096);
  assert.strictEqual(normalizeImageMaxDimension("0"), 2048);
  assert.strictEqual(normalizeImageMaxDimension("-500"), 2048);
  assert.strictEqual(normalizeImageMaxDimension("100"), 512); // clamped to min 512
  assert.strictEqual(normalizeImageMaxDimension("10000"), 8192); // clamped to max 8192
});
