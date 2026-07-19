import test from "node:test";
import assert from "node:assert";
import { extractLastThinkingTopic } from "../../frontend/src/store/useStore";
import { truncateIncompleteMathBlocks, normalizeMessageMarkdown } from "../../frontend/src/components/ChatSession";

test("extractLastThinkingTopic falls back to Thinking... when no bold title matches but reasoning exists", () => {
  // Bold title exists
  assert.strictEqual(extractLastThinkingTopic("**Evaluating integrals**\nFirst we find the derivative..."), "Evaluating integrals");

  // No bold title but text exists
  assert.strictEqual(extractLastThinkingTopic("Let me think about how to solve this equation."), "Thinking...");

  // Empty or purely whitespace text should still be empty
  assert.strictEqual(extractLastThinkingTopic(""), "");
  assert.strictEqual(extractLastThinkingTopic("   \n  "), "");
});

test("truncateIncompleteMathBlocks correctly truncates incomplete/open math blocks", () => {
  // Complete display math block
  assert.strictEqual(
    truncateIncompleteMathBlocks("Normal text $$f(x) = x^2$$ more normal text"),
    "Normal text $$f(x) = x^2$$ more normal text"
  );

  // Incomplete display math block
  assert.strictEqual(
    truncateIncompleteMathBlocks("Normal text with $$f(x) = x^2"),
    "Normal text with "
  );

  // Single-dollar blocks (like currency or inline math) must not be truncated
  assert.strictEqual(
    truncateIncompleteMathBlocks("Price is $10$ and quantity is $5$"),
    "Price is $10$ and quantity is $5$"
  );

  assert.strictEqual(
    truncateIncompleteMathBlocks("Let $x = 3"),
    "Let $x = 3"
  );
});

test("normalizeMessageMarkdown cleans up weird math block spacing", () => {
  // Convert standard \( and \[
  assert.strictEqual(normalizeMessageMarkdown("Hello \\(x + y\\) and \\[A = B\\]"), "Hello $x + y$ and $$A = B$$");

  // Format GPT-5.6-like messy spacing inside $$
  assert.strictEqual(
    normalizeMessageMarkdown("$$\n \\int_0^1 x^2 dx \n\n$$"),
    "$$\n\\int_0^1 x^2 dx\n$$"
  );

  assert.strictEqual(
    normalizeMessageMarkdown("$$ \\alpha + \\beta $$"),
    "$$\n\\alpha + \\beta\n$$"
  );
});

test("robust reasoning_delta parsing logic", () => {
  const parseReasoningDeltaPiece = (payload: any, eventPayload: any) => {
    let piece = "";
    const rawDelta = eventPayload.reasoning_delta !== undefined ? eventPayload.reasoning_delta : payload.reasoning_delta;
    if (rawDelta !== undefined && rawDelta !== null) {
      piece = String(rawDelta);
    }
    return piece;
  };

  // Test Case 1: Standard string in eventPayload
  assert.strictEqual(
    parseReasoningDeltaPiece(
      { type: "reasoning_delta", payload: { reasoning_delta: " the" }, reasoning_delta: " the" },
      { reasoning_delta: " the" }
    ),
    " the"
  );

  // Test Case 2: Number as string in eventPayload
  assert.strictEqual(
    parseReasoningDeltaPiece(
      { type: "reasoning_delta", payload: { reasoning_delta: "8" }, reasoning_delta: "8" },
      { reasoning_delta: "8" }
    ),
    "8"
  );

  // Test Case 3: Numeric number in eventPayload
  assert.strictEqual(
    parseReasoningDeltaPiece(
      { type: "reasoning_delta", payload: { reasoning_delta: 8 }, reasoning_delta: 8 },
      { reasoning_delta: 8 }
    ),
    "8"
  );

  // Test Case 4: Missing in eventPayload but exists at root payload (fallback)
  assert.strictEqual(
    parseReasoningDeltaPiece(
      { type: "reasoning_delta", reasoning_delta: "fallback_text" },
      {}
    ),
    "fallback_text"
  );

  // Test Case 5: Missing everywhere
  assert.strictEqual(
    parseReasoningDeltaPiece(
      { type: "reasoning_delta" },
      {}
    ),
    ""
  );
});

test("normalizeMessageMarkdown is blockquote-safe and preserves leading '>' inside math blocks", () => {
  const blockquoteContent = `> Given the function
> \\[
> f(x)=\\frac{x}{e^x}=xe^{-x}.
> \\]
> If the equation
> \\[
> f(f(x))=a
> \\]
> has two distinct real roots \\(x_1,x_2\\), find the range of \\(a\\), and prove
> \\[
> x_1x_2<1.
> \\]`;

  const expectedNormalized = `> Given the function
> $$
> f(x)=\\frac{x}{e^x}=xe^{-x}.
> $$
> If the equation
> $$
> f(f(x))=a
> $$
> has two distinct real roots $x_1,x_2$, find the range of $a$, and prove
> $$
> x_1x_2<1.
> $$`;

  assert.strictEqual(normalizeMessageMarkdown(blockquoteContent), expectedNormalized);
});

test("normalizeMessageMarkdown removes leading indentation from display math blocks inside lists", () => {
  const indentedContent = `1.  **Step 1: Shift left by 2 units**
    According to the "left-add right-subtract" rule for the independent variable, shifting left by 2 units requires replacing the $x$ immediately following the variable in the expression with $(x+2)$:
    $$
    y = 2^x \\xrightarrow{\\text{shift left by 2 units}} y = 2^{x+2}
    $$`;

  const expectedNormalized = `1.  **Step 1: Shift left by 2 units**
    According to the "left-add right-subtract" rule for the independent variable, shifting left by 2 units requires replacing the $x$ immediately following the variable in the expression with $(x+2)$:
$$
y = 2^x \\xrightarrow{\\text{shift left by 2 units}} y = 2^{x+2}
$$`;

  assert.strictEqual(normalizeMessageMarkdown(indentedContent), expectedNormalized);
});

test("normalizeMessageMarkdown strips leading spaces before blockquote '>' characters to prevent code blocks", () => {
  const indentedBlockquote = `   > $$
   > y = 2^x
   > $$`;

  const expectedNormalized = `> $$
> y = 2^x
> $$`;

  assert.strictEqual(normalizeMessageMarkdown(indentedBlockquote), expectedNormalized);
});
