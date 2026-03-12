"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "@/lib/types";
import ToolCallBlock from "./ToolCallBlock";

interface MessageProps {
  message: ChatMessage;
}

export default function Message({ message }: MessageProps) {
  const isUser = message.role === "user";
  const isStreaming = message.streaming;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isUser
            ? "bg-forge-600 text-white"
            : "bg-gray-100 text-gray-900"
        }`}
      >
        {/* Markdown content */}
        {message.content ? (
          <div className={`prose prose-sm max-w-none ${isUser ? "prose-invert" : ""}`}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                pre: ({ children }) => (
                  <pre className="overflow-x-auto rounded bg-gray-800 p-2 text-xs text-gray-100">
                    {children}
                  </pre>
                ),
                code: ({ children, className }) => {
                  const isBlock = className?.startsWith("language-");
                  if (isBlock) return <code className={className}>{children}</code>;
                  return (
                    <code className={`rounded px-1 py-0.5 text-xs ${
                      isUser ? "bg-forge-700" : "bg-gray-200"
                    }`}>
                      {children}
                    </code>
                  );
                },
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer"
                    className={isUser ? "text-forge-200 underline" : "text-forge-600 underline"}>
                    {children}
                  </a>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        ) : isStreaming ? (
          <span className="inline-flex items-center gap-1 text-gray-400">
            <span className="animate-pulse">●</span> Thinking...
          </span>
        ) : null}

        {/* Tool calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-2">
            {message.toolCalls.map((tc, i) => (
              <ToolCallBlock key={`${tc.name}-${i}`} toolCall={tc} />
            ))}
          </div>
        )}

        {/* Streaming indicator */}
        {isStreaming && message.content && (
          <span className="inline-block animate-pulse text-forge-500 ml-0.5">▊</span>
        )}
      </div>
    </div>
  );
}
