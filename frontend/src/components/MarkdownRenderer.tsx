import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";

const REMARK_PLUGINS = [remarkGfm, remarkMath];
const REHYPE_PLUGINS: any[] = [[rehypeKatex, { strict: false, throwOnError: false }], rehypeHighlight];

export interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS}>
      {content}
    </ReactMarkdown>
  );
}
