export const normalizeMessageMarkdown = (content: string): string => {
  let normalized = content
    .replace(/\\\(([\s\S]*?)\\\)/g, "$$$1$")
    .replace(/\\\[([\s\S]*?)\\\]/g, (_match, group: string) => `$$${group}$$`);

  // Preprocess display math blocks to strip leading indentation (which otherwise parses as code blocks)
  const lines = normalized.split("\n");
  let insideMath = false;
  const processedLines = lines.map((line) => {
    const trimmed = line.trim();

    // Check if the line is a display math delimiter (ignoring blockquote markers)
    // Examples: "$$", "> $$", ">  $$", "   $$"
    const isDelimiter = /^(?:>\s*)*\$\$\s*$/.test(trimmed);

    if (isDelimiter) {
      insideMath = !insideMath;
      // Strip indentation for the delimiter line
      const blockquoteMatch = line.match(/^(\s*>\s*)+/);
      if (blockquoteMatch) {
        const prefix = blockquoteMatch[0];
        const normalizedPrefix = prefix.replace(/^\s+/, "");
        return normalizedPrefix + "$$";
      }
      return "$$";
    }

    if (insideMath) {
      // We are inside a display math block. Strip leading spaces/indentation.
      const blockquoteMatch = line.match(/^(\s*>\s*)+/);
      if (blockquoteMatch) {
        const prefix = blockquoteMatch[0];
        const normalizedPrefix = prefix.replace(/^\s+/, "");
        const contentAfterPrefix = line.slice(prefix.length).trim();
        return normalizedPrefix + contentAfterPrefix;
      }
      return trimmed;
    }

    return line;
  });
  normalized = processedLines.join("\n");

  // Ensure display math blocks ($$...$$) with weird whitespace are normalized for remark-math
  normalized = normalized.replace(/(?<!\\)\$\$(\s+)([\s\S]*?)(\s+)(?<!\\)\$\$/g, (match, _s1, formula, _s2) => {
    // If the matched display block contains a blockquote character, do not strip/trim it to avoid mangling blockquotes.
    if (match.includes(">")) {
      return match;
    }
    return `$$\n${formula.trim()}\n$$`;
  });

  return normalized;
};
