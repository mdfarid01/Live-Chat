"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Search } from "lucide-react";
import { UserButton, useUser } from "@clerk/nextjs";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ChatPanel } from "./chat-panel";
import { formatMessageTimestamp, isUserOnline } from "@/lib/time";

type ActivePreview = { name: string; lastSeen: number };

export function ChatShell() {
  const { user } = useUser();
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(Date.now());
  const [activeConversationId, setActiveConversationId] =
    useState<Id<"conversations"> | null>(null);
  const [activePreview, setActivePreview] = useState<ActivePreview | null>(null);

  const users = useQuery(api.users.list, { search }) ?? [];
  const conversations = useQuery(api.conversations.listForCurrentUser) ?? [];
  const getOrCreate = useMutation(api.conversations.getOrCreate);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  const activeConversation = useMemo(
    () => conversations.find((c) => c._id === activeConversationId) ?? null,
    [conversations, activeConversationId]
  );

  const openFromUser = async (u: {
    _id: Id<"users">;
    name: string;
    lastSeen: number;
  }) => {
    const id = await getOrCreate({ otherUserId: u._id });
    setActiveConversationId(id);
    setActivePreview({ name: u.name, lastSeen: u.lastSeen });
    setSearch("");
  };

  const showChatOnMobile = activeConversationId !== null;
  const title = activeConversation?.otherUserName ?? activePreview?.name ?? "Conversation";
  const online = isUserOnline(
    activeConversation?.otherUserLastSeen ?? activePreview?.lastSeen ?? 0,
    now
  );

  return (
    <div className="flex h-full">
      <aside
        className={`${showChatOnMobile ? "hidden md:flex" : "flex"} w-full flex-col border-r border-slate-200 bg-white md:w-80`}
      >
        <div className="border-b border-slate-200 p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Logged in as</p>
              <p className="font-medium">{user?.fullName ?? user?.username ?? "User"}</p>
            </div>
            <UserButton />
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users..."
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-500"
            />
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-3">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">People</p>
            {users.length === 0 ? (
              <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
                No search results.
              </p>
            ) : (
              <div className="space-y-1">
                {users.map((u) => (
                  <button
                    key={u._id}
                    onClick={() => void openFromUser(u)}
                    className="flex w-full items-center justify-between rounded-lg p-2 text-left hover:bg-slate-100"
                  >
                    <span className="truncate text-sm">{u.name}</span>
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        isUserOnline(u.lastSeen, now) ? "bg-emerald-500" : "bg-slate-300"
                      }`}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Conversations</p>
            {conversations.length === 0 ? (
              <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
                No conversations yet.
              </p>
            ) : (
              <div className="space-y-1">
                {conversations.map((c) => (
                  <button
                    key={c._id}
                    onClick={() => {
                      setActiveConversationId(c._id);
                      setActivePreview({ name: c.otherUserName, lastSeen: c.otherUserLastSeen });
                    }}
                    className={`w-full rounded-lg p-2 text-left hover:bg-slate-100 ${
                      activeConversationId === c._id ? "bg-slate-100" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="truncate text-sm font-medium">{c.otherUserName}</p>
                      {c.unreadCount > 0 && (
                        <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs text-white">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-slate-500">
                      {c.lastMessageText || "No messages yet"}
                    </p>
                    {c.lastMessageAt > 0 && (
                      <p className="mt-1 text-[11px] text-slate-400">
                        {formatMessageTimestamp(c.lastMessageAt)}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>

      <section
        className={`${showChatOnMobile ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col bg-slate-50`}
      >
        {activeConversationId ? (
          <ChatPanel
            conversationId={activeConversationId}
            title={title}
            isOnline={online}
            onBack={() => setActiveConversationId(null)}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-slate-500">
            Select a user or conversation to start chatting.
          </div>
        )}
      </section>
    </div>
  );
}
