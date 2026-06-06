"use client";

import { useEffect, useRef, useState } from "react";
import * as api from "@/lib/api";
import type { BoardData } from "@/lib/kanban";

type Message = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Add a card 'Review PR #42' to Backlog",
  "What's in my In Progress column?",
  "Move all cards from Review to Done",
];

type Props = {
  onBoardUpdate: (board: BoardData) => void;
  onClose: () => void;
};

export const AISidebar = ({ onBoardUpdate, onClose }: Props) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: "user", content }]);
    setLoading(true);
    try {
      const res = await api.aiChat(content, history);
      setMessages((prev) => [...prev, { role: "assistant", content: res.message }]);
      if (res.board_update) {
        onBoardUpdate(res.board);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong — please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <aside className="flex h-screen w-[380px] shrink-0 flex-col border-l border-[var(--stroke)] bg-white/95 backdrop-blur sticky top-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--stroke)] px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base">✦</span>
            <p className="text-sm font-semibold text-[var(--navy-dark)]">AI Assistant</p>
          </div>
          <p className="mt-0.5 text-xs text-[var(--gray-text)]">
            Ask me to manage your board
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close AI sidebar"
          className="rounded-lg p-1.5 text-[var(--gray-text)] transition hover:bg-[var(--surface)] hover:text-[var(--navy-dark)]"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Thread */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages.length === 0 && !loading && (
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-center text-xs text-[var(--gray-text)]">
              Try asking something like:
            </p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="rounded-xl border border-[var(--stroke)] bg-[var(--surface)] px-4 py-2.5 text-left text-xs text-[var(--navy-dark)] transition hover:border-[var(--primary-blue)] hover:bg-white"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            data-testid="message"
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {m.role === "assistant" && (
              <span className="mr-2 mt-1 shrink-0 text-sm">✦</span>
            )}
            <div
              className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-[var(--primary-blue)] text-white"
                  : "border border-[var(--stroke)] bg-[var(--surface)] text-[var(--navy-dark)]"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-2" data-testid="message">
            <span className="mt-1 shrink-0 text-sm text-[var(--gray-text)]">✦</span>
            <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--gray-text)]">
              <span className="inline-flex gap-1">
                <span className="animate-bounce" style={{ animationDelay: "0ms" }}>·</span>
                <span className="animate-bounce" style={{ animationDelay: "150ms" }}>·</span>
                <span className="animate-bounce" style={{ animationDelay: "300ms" }}>·</span>
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-[var(--stroke)] p-3">
        <div className="flex gap-2">
          <textarea
            aria-label="Message"
            placeholder="Ask AI to manage your board..."
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            className="flex-1 resize-none rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5 text-sm text-[var(--navy-dark)] placeholder:text-[var(--gray-text)] outline-none transition focus:border-[var(--primary-blue)] disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => send()}
            disabled={loading || !input.trim()}
            aria-label="Send"
            className="self-end rounded-xl bg-[var(--primary-blue)] px-4 py-2.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            Send
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-[var(--gray-text)]">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </aside>
  );
};
