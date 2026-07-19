import test from "node:test";
import assert from "node:assert";
import {
  getApiCallMode,
  setApiCallMode,
} from "../../backend/src/backend-utils";

test("getApiCallMode default and setApiCallMode persistence", async () => {
  let savedKey: string | null = null;
  let savedValue: string | null = null;
  let savedUserId: string | null = null;

  const db = {
    prepare: (query: string) => {
      // Mock SQLite SELECT and INSERT
      if (query.includes("SELECT value FROM app_settings")) {
        return {
          bind: (key: string, userId: string) => {
            return {
              first: async () => {
                if (key === "api_call_mode" && savedKey === "api_call_mode") {
                  return { value: savedValue };
                }
                return null;
              }
            };
          }
        };
      }
      if (query.includes("INSERT INTO app_settings")) {
        return {
          bind: (key: string, value: string, userId: string, now: number) => {
            savedKey = key;
            savedValue = value;
            savedUserId = userId;
            return {
              run: async () => {
                return { success: true };
              }
            };
          }
        };
      }
      return {
        bind: () => ({ first: async () => null, run: async () => ({ success: true }) })
      } as any;
    }
  } as any;

  // Default should be "fetch"
  const defaultMode = await getApiCallMode(db);
  assert.strictEqual(defaultMode, "fetch");

  // Set mode to "sdk"
  await setApiCallMode(db, "sdk");
  assert.strictEqual(savedKey, "api_call_mode");
  assert.strictEqual(savedValue, "fetch");
  assert.strictEqual(savedUserId, "single-user");

  // Get mode should still be "fetch" because Vercel SDK has been retired
  const updatedMode = await getApiCallMode(db);
  assert.strictEqual(updatedMode, "fetch");

  // Set mode to "fetch"
  await setApiCallMode(db, "fetch");
  assert.strictEqual(savedValue, "fetch");
  const finalMode = await getApiCallMode(db);
  assert.strictEqual(finalMode, "fetch");
});
