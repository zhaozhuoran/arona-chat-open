import test from "node:test";
import assert from "node:assert";
import {
  normalizeAttachmentMode,
  buildOpenRouterMessageContent,
  type AttachmentModelMeta,
  type ChatAttachmentPayload,
} from "../../backend/src/backend-utils";

test("normalizeAttachmentMode works as expected", () => {
  assert.strictEqual(normalizeAttachmentMode(undefined), "url");
  assert.strictEqual(normalizeAttachmentMode(null), "url");
  assert.strictEqual(normalizeAttachmentMode(""), "url");
  assert.strictEqual(normalizeAttachmentMode("unknown"), "url");
  assert.strictEqual(normalizeAttachmentMode("url"), "url");
  assert.strictEqual(normalizeAttachmentMode("base64"), "base64");
});

test("buildOpenRouterMessageContent resolves on-the-fly correctly in url and base64 mode", async () => {
  const mockCtx = {
    env: {
      R2_BUCKET: {
        get: async (key: string) => {
          if (key === "test-obj-key-img" || key === "test-obj-key-pdf") {
            return {
              arrayBuffer: async () => {
                return new TextEncoder().encode("mocked file data").buffer;
              },
            };
          }
          return null;
        },
      },
      AUTH_TOKEN_SECRET: "test-secret-key-12345678901234567890",
    },
    req: {
      url: "http://localhost/api/chat/stream",
    },
  } as any;

  const attachments: ChatAttachmentPayload[] = [
    {
      id: "attachment-1",
      file_name: "test.png",
      mime_type: "image/png",
      size: 100,
      url: "http://localhost/api/files/test.png",
      type: "image",
    },
    {
      id: "attachment-2",
      file_name: "doc.pdf",
      mime_type: "application/pdf",
      size: 200,
      url: "http://localhost/api/files/doc.pdf",
      type: "file",
    },
  ];

  const attachmentMetaById = new Map<string, AttachmentModelMeta>([
    [
      "attachment-1",
      {
        id: "attachment-1",
        file_name: "test.png",
        mime_type: "image/png",
        r2_url: "http://r2/test.png",
        r2_object_key: "test-obj-key-img",
        source: "attachments",
      },
    ],
    [
      "attachment-2",
      {
        id: "attachment-2",
        file_name: "doc.pdf",
        mime_type: "application/pdf",
        r2_url: "http://r2/doc.pdf",
        r2_object_key: "test-obj-key-pdf",
        source: "attachments",
      },
    ],
  ]);

  // 1. Test "url" mode (default / explicit)
  const urlResult = await buildOpenRouterMessageContent(
    mockCtx,
    "user",
    "Hello",
    attachments,
    attachmentMetaById,
    "url"
  );

  assert.ok(Array.isArray(urlResult), "In mixed content, result should be an array of ContentParts");
  const urlParts = urlResult as any[];
  assert.strictEqual(urlParts.length, 3); // image_url, file, text
  assert.strictEqual(urlParts[0].type, "image_url");
  assert.ok(urlParts[0].image_url.url.includes("/api/files/public"), "In URL mode, image part should use file proxy or public URL");
  assert.strictEqual(urlParts[1].type, "file");
  assert.ok(urlParts[1].file.file_data.includes("/api/files/public"), "In URL mode, file part should use file proxy or public URL");
  assert.strictEqual(urlParts[2].type, "text");
  assert.strictEqual(urlParts[2].text, "Hello");

  // 2. Test "base64" mode on-the-fly
  const b64Result = await buildOpenRouterMessageContent(
    mockCtx,
    "user",
    "Hello Base64",
    attachments,
    attachmentMetaById,
    "base64"
  );

  assert.ok(Array.isArray(b64Result), "In mixed content, result should be an array of ContentParts");
  const b64Parts = b64Result as any[];
  assert.strictEqual(b64Parts.length, 3); // image_url, file, text
  assert.strictEqual(b64Parts[0].type, "image_url");
  // bW9ja2VkIGZpbGUgZGF0YQ== is the Base64 of "mocked file data"
  assert.strictEqual(b64Parts[0].image_url.url, "data:image/png;base64,bW9ja2VkIGZpbGUgZGF0YQ==");
  assert.strictEqual(b64Parts[1].type, "file");
  assert.strictEqual(b64Parts[1].file.file_data, "data:application/pdf;base64,bW9ja2VkIGZpbGUgZGF0YQ==");
  assert.strictEqual(b64Parts[2].type, "text");
  assert.strictEqual(b64Parts[2].text, "Hello Base64");
});

test("routes-account module loads successfully and can resolve normalizeAttachmentMode", async () => {
  // Importing routes-account.ts will load and parse the file, checking all static references
  const routesAccount = await import("../../backend/src/routes-account");
  assert.ok(routesAccount, "routes-account module should load successfully");
});
