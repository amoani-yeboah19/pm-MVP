"use client";

import { useEffect, useRef, useState } from "react";
import * as api from "@/lib/api";
import type { BoardData } from "@/lib/kanban";

type Message = { role: "user" | "assistant"; content: string };

type Props = {
  onBoardUpdate: (board: BoardData) => void;
};

export const AISidebar = ({ onBoardUpdate }: Props) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);
    try {
      const res = await api.aiChat(text, history);
      setMessages((prev) => [...prev, { role: "assistant", content: res.message }]);
      if (res.board_update) {
        onBoardUpdate(res.board);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong. Please try again." },
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
    <aside className="flex w-[360px] shrink-0 flex-col border-l border-[var(--stroke)] bg-white/90 backdrop-blur">
      <div className="border-b border-[var(--stroke)] px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
          AI Assistant
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages.length === 0 && !loading && (
          <p className="mt-6 text-center text-xs text-[var(--gray-text)]">
            Ask AI to help manage your board
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            data-testid="message"
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-5 ${
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
          <div className="flex justify-start" data-testid="message">
            <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--gray-text)]">
              Thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-[var(--stroke)] p-3">
        <div className="flex gap-2">
          <textarea
            aria-label="Message"
            placeholder="Ask AI..."
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            className="flex-1 resize-none rounded-xl border border-[var(--stroke)] bg-white px-3 py-2.5 text-sm text-[var(--navy-dark)] placeholder-[var(--gray-text)] outline-none focus:border-[var(--primary-blue)] disabled:opacity-50"
          />
          <button
            type="button"
            onClick={send}
            disabled={loading || !input.trim()}
            aria-label="Send"
            className="self-end rounded-xl bg-[var(--primary-blue)] px-4 py-2.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </aside>
  );
};
