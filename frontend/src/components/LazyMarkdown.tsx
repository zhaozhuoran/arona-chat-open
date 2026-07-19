import { memo, lazy, Suspense } from "react";

const MarkdownRenderer = lazy(() => import("./MarkdownRenderer"));

export const LazyMarkdown = memo(({ content }: { content: string }) => {
  return (
    <Suspense fallback={<div className="ba-markdown-loading">...</div>}>
      <MarkdownRenderer content={content} />
    </Suspense>
  );
});

LazyMarkdown.displayName = "LazyMarkdown";
