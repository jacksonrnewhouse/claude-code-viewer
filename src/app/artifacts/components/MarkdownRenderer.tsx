"use client";

import hljs from "highlight.js";
import { Marked } from "marked";
import { type FC, useEffect, useMemo, useRef } from "react";
import "highlight.js/styles/github.css";

const marked = new Marked({
  gfm: true,
});

type Props = {
  content: string;
};

export const MarkdownRenderer: FC<Props> = ({ content }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const html = useMemo(
    () => marked.parse(content, { async: false }),
    [content],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-highlight when rendered html changes
  useEffect(() => {
    if (!containerRef.current) return;
    const codeBlocks =
      containerRef.current.querySelectorAll<HTMLElement>("pre code");
    for (const block of codeBlocks) {
      hljs.highlightElement(block);
    }
  }, [html]);

  return (
    <div
      ref={containerRef}
      className="markdown-content mx-auto max-w-3xl px-6 py-8 text-gray-900"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: Rendering trusted markdown content from artifacts
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
