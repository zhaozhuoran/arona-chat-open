import test from "node:test";
import assert from "node:assert";

test("Manual and auto-title generation reference construction with attachments", async () => {
  // Mock a user message with attachments to test transcript construction logic
  const mockUserMsg = {
    role: "user" as const,
    content: "Explain this homework",
    attachments: [
      { file_name: "homework.pdf", mime_type: "application/pdf" },
      { file_name: "diagram.png", mime_type: "image/png" }
    ]
  };

  // Map user message following our routes-account / DO update logic
  let content = mockUserMsg.content.trim();
  if (Array.isArray(mockUserMsg.attachments) && mockUserMsg.attachments.length > 0) {
    const attachmentNames = mockUserMsg.attachments.map((att) => att.file_name || "unnamed file").join(", ");
    if (content) {
      content += ` [Attachments: ${attachmentNames}]`;
    } else {
      content = `[Attachments: ${attachmentNames}]`;
    }
  }

  assert.strictEqual(content, "Explain this homework [Attachments: homework.pdf, diagram.png]");

  // Test empty user content with attachments
  const mockUserMsgEmptyText = {
    role: "user" as const,
    content: "",
    attachments: [
      { file_name: "image1.jpg", mime_type: "image/jpeg" }
    ]
  };

  let emptyTextContent = mockUserMsgEmptyText.content.trim();
  if (Array.isArray(mockUserMsgEmptyText.attachments) && mockUserMsgEmptyText.attachments.length > 0) {
    const attachmentNames = mockUserMsgEmptyText.attachments.map((att) => att.file_name || "unnamed file").join(", ");
    if (emptyTextContent) {
      emptyTextContent += ` [Attachments: ${attachmentNames}]`;
    } else {
      emptyTextContent = `[Attachments: ${attachmentNames}]`;
    }
  }

  assert.strictEqual(emptyTextContent, "[Attachments: image1.jpg]");
});
