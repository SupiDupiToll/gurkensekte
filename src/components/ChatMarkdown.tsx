"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Markdown-Anzeige für Gürkchen-Antworten im Chat.
 * Sicherheit: kein rehype-raw – rohes HTML aus LLM-Antworten wird als Text
 * dargestellt, nicht gerendert. User-Nachrichten bleiben bewusst Plaintext.
 */
export function ChatMarkdown({ text }: { text: string }) {
  return (
    <div className="chat-md break-words text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="my-1 first:mt-0 last:mb-0">{children}</p>,
          strong: ({ children }) => (
            <strong className="font-semibold text-[#faf8f1]">{children}</strong>
          ),
          em: ({ children }) => <em className="text-[#e3e9d3]">{children}</em>,
          ul: ({ children }) => (
            <ul className="my-1 list-disc space-y-0.5 pl-5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-1 list-decimal space-y-0.5 pl-5">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          code: ({ children }) => (
            <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-[13px] text-[#e2d9bf]">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="my-2 overflow-x-auto rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-[13px] leading-relaxed">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-1 border-l-2 border-[#8fa96d]/60 pl-3 italic text-[#cfc8b0]">
              {children}
            </blockquote>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="font-semibold text-[#abc189] underline underline-offset-2 hover:text-[#c9d6ae]"
            >
              {children}
            </a>
          ),
          h1: ({ children }) => (
            <p className="mb-1 mt-2 font-display text-base font-semibold text-[#faf8f1]">{children}</p>
          ),
          h2: ({ children }) => (
            <p className="mb-1 mt-2 font-display text-base font-semibold text-[#faf8f1]">{children}</p>
          ),
          h3: ({ children }) => (
            <p className="mb-1 mt-2 text-sm font-semibold text-[#faf8f1]">{children}</p>
          ),
          h4: ({ children }) => (
            <p className="mb-1 mt-2 text-sm font-semibold text-[#faf8f1]">{children}</p>
          ),
          hr: () => <hr className="my-2 border-white/10" />,
          table: ({ children }) => (
            <span className="my-2 block overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">{children}</table>
            </span>
          ),
          th: ({ children }) => (
            <th className="border border-white/10 bg-white/[0.05] px-2 py-1 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-white/10 px-2 py-1">{children}</td>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
