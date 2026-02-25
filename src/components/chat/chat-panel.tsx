"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ChevronLeft } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { formatMessageTimestamp } from "@/lib/time";

type Props = {
  conversationId: Id<"conversations">;
  title: string;
  isOnline: boolean;
  onBack: () => void;
};

export function ChatPanel({ conversationId, title, isOnline, onBack }: Props) {
  const messages = useQuery(api.messages.list, { conversationId }) ?? [];
  const typingRaw = useQuery(api.typing.getOtherTyping, { conversationId });
  const send = useMutation(api.messages.send);
  const setTyping = useMutation(api.typing.setTyping);
  const markAsRead = useMutation(api.conversations.markAsRead);

  const [draft, setDraft] = useState("");
  const [now, setNow] = useState(Date.now());
  const [stickBottom, setStickBottom] = useState(true);
  const [showNewBtn, setShowNewBtn] = useState(false);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const stopTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevCount = useRef(0);

  const typing = useMemo(() => {
    if (!typingRaw) return null;
    return typingRaw.expiresAt > now ? typingRaw : null;
  }, [typingRaw, now]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    void markAsRead({ conversationId });
    prevCount.current = 0;
    setShowNewBtn(false);
    requestAnimationFrame(() => {
      const el = scrollerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
    return () => {
      if (stopTypingTimer.current) clearTimeout(stopTypingTimer.current);
      void setTyping({ conversationId, isTyping: false });
    };
  }, [conversationId, markAsRead, setTyping]);

  useEffect(() => {
    if (messages.length > 0) void markAsRead({ conversationId });
    if (messages.length <= prevCount.current) return;

    const el = scrollerRef.current;
    if (!el) return;

    if (stickBottom) {
      requestAnimationFrame(() => {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      });
      setShowNewBtn(false);
    } else {
      setShowNewBtn(true);
    }
    prevCount.current = messages.length;
  }, [messages.length, stickBottom, conversationId, markAsRead]);

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    setStickBottom(nearBottom);
    if (nearBottom) setShowNewBtn(false);
  };

  const scheduleStopTyping = () => {
    if (stopTypingTimer.current) clearTimeout(stopTypingTimer.current);
    stopTypingTimer.current = setTimeout(() => {
      void setTyping({ conversationId, isTyping: false });
    }, 2000);
  };

  const onChangeDraft = (value: string) => {
    setDraft(value);
    if (!value.trim()) {
      void setTyping({ conversationId, isTyping: false });
      return;
    }
    void setTyping({ conversationId, isTyping: true });
    scheduleStopTyping();
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    await send({ conversationId, body });
    setDraft("");
    if (stopTypingTimer.current) clearTimeout(stopTypingTimer.current);
    await setTyping({ conversationId, isTyping: false });
  };

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <button onClick={onBack} className="md:hidden">
          <ChevronLeft className="h-5 w-5 text-slate-600" />
        </button>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className={`text-xs ${isOnline ? "text-emerald-600" : "text-slate-500"}`}>
            {isOnline ? "Online" : "Offline"}
          </p>
        </div>
      </div>

      <div ref={scrollerRef} onScroll={onScroll} className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="rounded-lg bg-white p-4 text-sm text-slate-500">
            No messages yet. Say hello.
          </div>
        )}

        {messages.map((m) => (
          <div key={m._id} className={`flex ${m.isMine ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                m.isMine
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-900"
              }`}
            >
              <p className="text-sm">{m.body}</p>
              <p className={`mt-1 text-[11px] ${m.isMine ? "text-slate-300" : "text-slate-500"}`}>
                {formatMessageTimestamp(m.createdAt)}
              </p>
            </div>
          </div>
        ))}

        {typing && (
          <div className="text-xs text-slate-500">
            {typing.name} is typing...
          </div>
        )}
      </div>

      {showNewBtn && (
        <button
          onClick={() => {
            const el = scrollerRef.current;
            if (!el) return;
            el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
            setShowNewBtn(false);
          }}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-full bg-slate-900 px-3 py-1 text-xs text-white"
        >
          ↓ New messages
        </button>
      )}

      <form onSubmit={onSubmit} className="border-t border-slate-200 bg-white p-3">
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => onChangeDraft(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 outline-none"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
