import test from "node:test";
import assert from "node:assert";
import { getSingleFileSizeLimitBytes } from "../../backend/src/resource-limits";

test("getSingleFileSizeLimitBytes dynamic calculation and defaults", async () => {
  // Test default configuration (no custom env variable set)
  const defaultBytes = getSingleFileSizeLimitBytes({});
  assert.strictEqual(defaultBytes, 25 * 1024 * 1024);

  // Test custom configuration via LIMIT_SINGLE_FILE_SIZE_MB env variable
  const customBytes = getSingleFileSizeLimitBytes({ LIMIT_SINGLE_FILE_SIZE_MB: "10" });
  assert.strictEqual(customBytes, 10 * 1024 * 1024);

  // Test float inputs handle gracefully
  const customBytesFloat = getSingleFileSizeLimitBytes({ LIMIT_SINGLE_FILE_SIZE_MB: "2.5" });
  assert.strictEqual(customBytesFloat, 2.5 * 1024 * 1024);
});
