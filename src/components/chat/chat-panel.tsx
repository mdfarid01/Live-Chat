"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ChevronLeft } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

import { formatMessageTimestamp } from "@/lib/time";

type Props = {
  conversationId: Id<"conversations">;
  title: string;
  isOnline: boolean;
  onBack: () => void;
};

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢"] as const;

// Active chat panel with realtime messages, typing, smart autoscroll, delete, and reactions.
export function ChatPanel({ conversationId, title, isOnline, onBack }: Props) {
  const messages = useQuery(api.messages.list, { conversationId }) ?? [];
  const typingRaw = useQuery(api.typing.getOtherTyping, { conversationId });
  const send = useMutation(api.messages.send);
  const deleteOwn = useMutation(api.messages.deleteOwn);
  const toggleReaction = useMutation(api.messages.toggleReaction);
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
      <div className="flex items-center gap-3 border-b border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur-xl">
        <button
          onClick={onBack}
          className="rounded-lg p-1.5 transition hover:bg-slate-100 md:hidden"
        >
          <ChevronLeft className="h-5 w-5 text-slate-700" />
        </button>
        <div>
          <p className="text-base font-semibold text-slate-900">{title}</p>
          <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <span
              className={`h-2 w-2 rounded-full ${isOnline ? "bg-emerald-500" : "bg-slate-400"}`}
            />
            {isOnline ? "Online" : "Offline"}
          </p>
        </div>
      </div>

      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="chat-grid-bg flex-1 space-y-3 overflow-y-auto p-4"
      >
        {messages.length === 0 && (
          <div className="rounded-xl border border-slate-200/80 bg-white/85 p-4 text-sm text-slate-500 shadow-sm">
            No messages yet. Say hello.
          </div>
        )}

        {messages.map((m) => (
          <div key={m._id} className={`flex ${m.isMine ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2.5 shadow-sm ${
                m.isMine
                  ? "bg-gradient-to-r from-sky-600 to-cyan-600 text-white"
                  : "border border-slate-200/80 bg-white/95 text-slate-900"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <p
                  className={`text-sm ${
                    m.deletedAt ? "italic text-slate-200/90" : ""
                  } ${m.isMine ? "" : m.deletedAt ? "text-slate-500" : ""}`}
                >
                  {m.deletedAt ? "This message was deleted" : m.body}
                </p>

                {m.isMine && !m.deletedAt && (
                  <button
                    type="button"
                    onClick={() => void deleteOwn({ messageId: m._id })}
                    className={`shrink-0 text-[11px] font-medium underline-offset-2 hover:underline ${
                      m.isMine ? "text-sky-100" : "text-slate-500"
                    }`}
                  >
                    Delete
                  </button>
                )}
              </div>

              <p className={`mt-1 text-[11px] ${m.isMine ? "text-sky-100" : "text-slate-500"}`}>
                {formatMessageTimestamp(m.createdAt)}
              </p>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {REACTIONS.map((emoji) => {
                 const reactionEntries = Array.isArray(m.reactions) ? m.reactions : [];
                  const reaction = reactionEntries.find((r) => r.emoji === emoji);
                  const count = reaction?.count ?? 0;
                  const reactedByMe = reaction?.reactedByMe ?? false;

                  return (
                    <button
                      key={emoji}
                      type="button"
                      disabled={Boolean(m.deletedAt)}
                      onClick={() => void toggleReaction({ messageId: m._id, emoji })}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition ${
                        reactedByMe
                          ? "bg-white/95 text-slate-900"
                          : m.isMine
                          ? "bg-white/20 text-white hover:bg-white/30"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      } disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      <span>{emoji}</span>
                      {count > 0 && <span>{count}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}

        {typing && (
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/90 px-3 py-1.5 text-xs text-slate-600 shadow-sm">
            <span className="font-medium text-slate-700">{typing.name} is typing</span>
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:300ms]" />
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
          className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-sky-600 to-cyan-600 px-3 py-1 text-xs font-medium text-white shadow-lg shadow-sky-500/30"
        >
          ↓ New messages
        </button>
      )}

      <form
        onSubmit={onSubmit}
        className="border-t border-slate-200/70 bg-white/85 p-3 backdrop-blur-xl"
      >
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => onChangeDraft(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 rounded-xl border border-slate-300/80 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-sky-500/25 transition focus:border-sky-500 focus:ring-4"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-sky-500/25 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
