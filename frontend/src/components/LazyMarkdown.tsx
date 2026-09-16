import { memo } from "react";
import MarkdownRenderer from "./MarkdownRenderer";

export const LazyMarkdown = memo(({ content }: { content: string }) => {
  return <MarkdownRenderer content={content} />;
});

LazyMarkdown.displayName = "LazyMarkdown";
