import test from "node:test";
import assert from "node:assert";
import { assertSafeEndpoint, resolveAiProvider } from "../../backend/src/backend-utils";

test("assertSafeEndpoint protocols and hostname restrictions", () => {
  // Safe endpoint
  assert.strictEqual(
    assertSafeEndpoint("https://api.openai.com/v1"),
    "https://api.openai.com/v1"
  );

  // Rejected protocols
  assert.throws(() => {
    assertSafeEndpoint("http://api.openai.com/v1");
  }, /Endpoint must use https./);

  assert.throws(() => {
    assertSafeEndpoint("ftp://api.openai.com/v1");
  }, /Endpoint must use https./);

  // Rejected hostnames (localhost, internal, local)
  assert.throws(() => {
    assertSafeEndpoint("https://localhost/v1");
  }, /Endpoint host not allowed./);

  assert.throws(() => {
    assertSafeEndpoint("https://my-service.internal/v1");
  }, /Endpoint host not allowed./);

  assert.throws(() => {
    assertSafeEndpoint("https://my-service.local/v1");
  }, /Endpoint host not allowed./);
});

test("assertSafeEndpoint private and loopback IPv4 ranges", () => {
  // Loopback
  assert.throws(() => {
    assertSafeEndpoint("https://127.0.0.1/v1");
  }, /Endpoint host not allowed./);

  assert.throws(() => {
    assertSafeEndpoint("https://127.3.1.2/v1");
  }, /Endpoint host not allowed./);

  // Private class A, B, C
  assert.throws(() => {
    assertSafeEndpoint("https://10.0.0.1/v1");
  }, /Endpoint host not allowed./);

  assert.throws(() => {
    assertSafeEndpoint("https://192.168.1.100/v1");
  }, /Endpoint host not allowed./);

  assert.throws(() => {
    assertSafeEndpoint("https://172.16.5.5/v1");
  }, /Endpoint host not allowed./);

  assert.throws(() => {
    assertSafeEndpoint("https://172.31.255.255/v1");
  }, /Endpoint host not allowed./);

  // Link-local
  assert.throws(() => {
    assertSafeEndpoint("https://169.254.169.254/v1");
  }, /Endpoint host not allowed./);

  // Allowed public IP or domain
  assert.strictEqual(
    assertSafeEndpoint("https://8.8.8.8/v1"),
    "https://8.8.8.8/v1"
  );
});

test("assertSafeEndpoint private and loopback IPv6 ranges", () => {
  // Loopback
  assert.throws(() => {
    assertSafeEndpoint("https://[::1]/v1");
  }, /Endpoint host not allowed./);

  assert.throws(() => {
    assertSafeEndpoint("https://[0:0:0:0:0:0:0:1]/v1");
  }, /Endpoint host not allowed./);

  // Unique local / private (fc00::/7)
  assert.throws(() => {
    assertSafeEndpoint("https://[fc00::1]/v1");
  }, /Endpoint host not allowed./);

  assert.throws(() => {
    assertSafeEndpoint("https://[fd12:3456:789a:1::1]/v1");
  }, /Endpoint host not allowed./);

  // Link-local (fe80::/10)
  assert.throws(() => {
    assertSafeEndpoint("https://[fe80::1]/v1");
  }, /Endpoint host not allowed./);

  assert.throws(() => {
    assertSafeEndpoint("https://[feb0::1234]/v1");
  }, /Endpoint host not allowed./);

  // Allowed public IPv6
  assert.strictEqual(
    assertSafeEndpoint("https://[2001:4860:4860::8888]/v1"),
    "https://[2001:4860:4860::8888]/v1"
  );
});

test("assertSafeEndpoint bypasses in E2E testing environment", () => {
  const envEnabled = { E2E_TEST: "true" } as any;

  // With E2E_TEST enabled, normally blocked endpoints are allowed
  assert.strictEqual(
    assertSafeEndpoint("http://localhost:8787/v1", envEnabled),
    "http://localhost:8787/v1"
  );

  assert.strictEqual(
    assertSafeEndpoint("https://169.254.169.254/latest/meta-data", envEnabled),
    "https://169.254.169.254/latest/meta-data"
  );
});

test("resolveAiProvider re-validates custom provider endpoints and rejects unsafe ones", async () => {
  const unsafeEnv = {
    D1_DB: {
      prepare: () => ({
        bind: () => ({
          first: async () => ({
            endpoint: "http://127.0.0.1:8787/api",
            api_key_encrypted: null,
            is_built_in: 1,
            owner_id: "admin-id",
            visibility: "private",
            model_id: "custom-unsafe-model",
            name: "Unsafe Model",
            input_usd_per_million: 0,
            output_usd_per_million: 0,
          })
        })
      })
    } as any,
    AI_API_KEY: "test",
  } as any;

  const auth = { sub: "admin-id", isAdmin: true, canManageAi: true };

  // Should fail because endpoint is unsafe
  await assert.rejects(
    async () => {
      await resolveAiProvider(unsafeEnv, "custom-unsafe-model", auth);
    },
    /Endpoint must use https./
  );

  // With E2E_TEST enabled, it should pass
  const safeE2eEnv = {
    ...unsafeEnv,
    E2E_TEST: "true",
  };
  const resolved = await resolveAiProvider(safeE2eEnv, "custom-unsafe-model", auth);
  assert.strictEqual(resolved.endpoint, "http://127.0.0.1:8787/api");
});

test("assertSafeEndpoint rejects IPv4-mapped and IPv4-compatible IPv6 addresses", () => {
  // IPv4-mapped with dots
  assert.throws(() => {
    assertSafeEndpoint("https://[::ffff:127.0.0.1]/v1");
  }, /Endpoint host not allowed./);

  assert.throws(() => {
    assertSafeEndpoint("https://[::ffff:192.168.1.1]/v1");
  }, /Endpoint host not allowed./);

  // IPv4-mapped with hex
  assert.throws(() => {
    assertSafeEndpoint("https://[::ffff:7f00:1]/v1"); // 127.0.0.1
  }, /Endpoint host not allowed./);

  assert.throws(() => {
    assertSafeEndpoint("https://[::ffff:c0a8:0101]/v1"); // 192.168.1.1
  }, /Endpoint host not allowed./);

  // IPv4-compatible with dots
  assert.throws(() => {
    assertSafeEndpoint("https://[::127.0.0.1]/v1");
  }, /Endpoint host not allowed./);

  // IPv4-compatible with hex
  assert.throws(() => {
    assertSafeEndpoint("https://[::7f00:1]/v1"); // 127.0.0.1
  }, /Endpoint host not allowed./);

  // Allowed public IPv4-mapped IPv6
  assert.strictEqual(
    assertSafeEndpoint("https://[::ffff:8.8.8.8]/v1"),
    "https://[::ffff:808:808]/v1"
  );
});

test("assertSafeEndpoint blocks alternative IPv4 representations (SSRF bypass attempt)", () => {
  // Decimal integer representations of loopback / private / local system
  assert.throws(() => {
    assertSafeEndpoint("https://2130706433/v1"); // 127.0.0.1
  }, /Endpoint host not allowed./);

  assert.throws(() => {
    assertSafeEndpoint("https://167772161/v1"); // 10.0.0.1
  }, /Endpoint host not allowed./);

  assert.throws(() => {
    assertSafeEndpoint("https://0/v1"); // 0.0.0.0
  }, /Endpoint host not allowed./);

  // Hexadecimal representations of loopback / private
  assert.throws(() => {
    assertSafeEndpoint("https://0x7f000001/v1"); // 127.0.0.1
  }, /Endpoint host not allowed./);

  assert.throws(() => {
    assertSafeEndpoint("https://0x0a000001/v1"); // 10.0.0.1
  }, /Endpoint host not allowed./);

  // Octal representations of loopback / private
  assert.throws(() => {
    assertSafeEndpoint("https://0177.0.0.1/v1"); // 127.0.0.1
  }, /Endpoint host not allowed./);

  assert.throws(() => {
    assertSafeEndpoint("https://012.0.0.1/v1"); // 10.0.0.1
  }, /Endpoint host not allowed./);

  // Mixed/short-form representations of loopback / private
  assert.throws(() => {
    assertSafeEndpoint("https://127.1/v1"); // 127.0.0.1
  }, /Endpoint host not allowed./);

  assert.throws(() => {
    assertSafeEndpoint("https://10.1/v1"); // 10.0.0.1
  }, /Endpoint host not allowed./);

  assert.throws(() => {
    assertSafeEndpoint("https://172.16.1/v1"); // 172.16.0.1
  }, /Endpoint host not allowed./);

  // Legitimate domains with hex-like chars are allowed
  assert.strictEqual(
    assertSafeEndpoint("https://cafe.de/v1"),
    "https://cafe.de/v1"
  );

  assert.strictEqual(
    assertSafeEndpoint("https://google.com/v1"),
    "https://google.com/v1"
  );
});
