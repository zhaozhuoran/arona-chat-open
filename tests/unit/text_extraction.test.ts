import test from "node:test";
import assert from "node:assert";
import { isTextFile, buildOpenRouterMessageContent } from "../../backend/src/backend-utils";
import type { AppContext, ChatAttachmentPayload, AttachmentModelMeta } from "../../backend/src/backend-utils";

test("isTextFile extension and MIME type classification", () => {
  // Test by mime type starting with text/
  assert.strictEqual(isTextFile("readme", "text/markdown"), true);
  assert.strictEqual(isTextFile("some_file", "text/plain"), true);

  // Test by application/json and other text MIME types
  assert.strictEqual(isTextFile("data", "application/json"), true);
  assert.strictEqual(isTextFile("script", "application/javascript"), true);

  // Test by extensions
  assert.strictEqual(isTextFile("document.md", "application/octet-stream"), true);
  assert.strictEqual(isTextFile("App.tsx", "application/octet-stream"), true);
  assert.strictEqual(isTextFile("config.yaml", "application/octet-stream"), true);

  // Test non-text files
  assert.strictEqual(isTextFile("photo.png", "image/png"), false);
  assert.strictEqual(isTextFile("audio.mp3", "audio/mp3"), false);
  assert.strictEqual(isTextFile("archive.zip", "application/zip"), false);
});

test("buildOpenRouterMessageContent XML extraction vs URL fallback", async () => {
  // Setup mocks
  const mockR2Get = async (key: string) => {
    if (key === "attachments/my_text.md") {
      return {
        text: async () => "# Hello Markdown",
      };
    }
    return null;
  };

  const mockCtx = {
    env: {
      R2_BUCKET: {
        get: mockR2Get,
      },
    },
  } as unknown as AppContext;

  const attachments: ChatAttachmentPayload[] = [
    {
      id: "att-1",
      file_name: "my_text.md",
      mime_type: "text/markdown",
      size: 500, // 500 bytes (<= 1MB)
      url: "https://r2-proxy/my_text.md",
      type: "file",
    },
  ];

  const attachmentMetaById = new Map<string, AttachmentModelMeta>([
    [
      "att-1",
      {
        id: "att-1",
        file_name: "my_text.md",
        mime_type: "text/markdown",
        r2_url: "https://r2/attachments/my_text.md",
        r2_object_key: "attachments/my_text.md",
        source: "attachments",
      },
    ],
  ]);

  // Test with XML extraction mode enabled
  const resultXml = await buildOpenRouterMessageContent(
    mockCtx,
    "user",
    "How is this markdown?",
    attachments,
    attachmentMetaById,
    "url",
    "xml"
  );

  assert.ok(typeof resultXml === "string");
  assert.ok(resultXml.includes("<file_attachment name=\"my_text.md\" mime_type=\"text/markdown\" size=\"500\">"));
  assert.ok(resultXml.includes("# Hello Markdown"));
  assert.ok(resultXml.includes("</file_attachment>"));
  assert.ok(resultXml.includes("How is this markdown?"));

  // Test with URL mode enabled
  const resultUrl = await buildOpenRouterMessageContent(
    mockCtx,
    "user",
    "How is this markdown?",
    attachments,
    attachmentMetaById,
    "url",
    "url"
  );

  assert.ok(typeof resultUrl === "string");
  assert.ok(!resultUrl.includes("<file_attachment"));
  assert.ok(resultUrl.includes("Attachment: my_text.md (text/markdown) https://r2-proxy/my_text.md"));
});

test("buildOpenRouterMessageContent errors when text file exceeds 1MB", async () => {
  const mockCtx = {} as unknown as AppContext;

  const largeAttachments: ChatAttachmentPayload[] = [
    {
      id: "att-large",
      file_name: "large_log.txt",
      mime_type: "text/plain",
      size: 2 * 1024 * 1024, // 2MB (> 1MB)
      url: "https://r2-proxy/large_log.txt",
      type: "file",
    },
  ];

  const attachmentMetaById = new Map<string, AttachmentModelMeta>([
    [
      "att-large",
      {
        id: "att-large",
        file_name: "large_log.txt",
        mime_type: "text/plain",
        r2_url: "https://r2/attachments/large_log.txt",
        r2_object_key: "attachments/large_log.txt",
        source: "attachments",
      },
    ],
  ]);

  await assert.rejects(
    async () => {
      await buildOpenRouterMessageContent(
        mockCtx,
        "user",
        "Explain this log",
        largeAttachments,
        attachmentMetaById,
        "url",
        "xml"
      );
    },
    (err: Error) => {
      assert.match(err.message, /exceeds the 1MB limit for text extraction/);
      return true;
    }
  );
});
