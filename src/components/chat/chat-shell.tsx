"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Search } from "lucide-react";
import { UserButton, useUser } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

import { ChatPanel } from "./chat-panel";
import { formatMessageTimestamp, isUserOnline } from "@/lib/time";

type ActivePreview = { name: string; lastSeen: number };

// Skeleton rows used while sidebar queries are still loading.
function SidebarSkeletonRows({ count }: { count: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-slate-200/80 bg-white/80 p-2.5 animate-pulse"
        >
          <div className="h-3.5 w-2/3 rounded bg-slate-200/80" />
          <div className="mt-2 h-2.5 w-1/2 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

// Main two-pane chat shell (sidebar + active conversation panel).
export function ChatShell() {
  const { user } = useUser();
  // Local UI state for filtering and active thread selection.
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(Date.now());
  const [activeConversationId, setActiveConversationId] =
    useState<Id<"conversations"> | null>(null);
  const [activePreview, setActivePreview] = useState<ActivePreview | null>(null);

  // Realtime sidebar data from Convex.
  const usersQuery = useQuery(api.users.list, { search });
  const conversationsQuery = useQuery(api.conversations.listForCurrentUser);
  // Convex query returns `undefined` while loading.
  const users = usersQuery ?? [];
  const conversations = conversationsQuery ?? [];
  const isUsersLoading = usersQuery === undefined;
  const isConversationsLoading = conversationsQuery === undefined;
  const getOrCreate = useMutation(api.conversations.getOrCreate);

  // Tick for online/offline indicator recalculation.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  const activeConversation = useMemo(
    () => conversations.find((c) => c._id === activeConversationId) ?? null,
    [conversations, activeConversationId]
  );

  // Open/create DM from the people search list.
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
    <div className="flex h-full bg-[radial-gradient(circle_at_top,_#f0f9ff_0%,_#e2e8f0_35%,_#f8fafc_100%)]">
      {/* Sidebar: account summary, people search, conversation list */}
      <aside
        className={`${showChatOnMobile ? "hidden md:flex" : "flex"} w-full flex-col border-r border-slate-200/70 bg-white/85 shadow-2xl shadow-slate-900/5 backdrop-blur-xl md:w-80`}
      >
        <div className="border-b border-slate-200/70 p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-sky-700/70">
                Logged in as
              </p>
              <p className="text-base font-semibold text-slate-900">
                {user?.fullName ?? user?.username ?? "User"}
              </p>
            </div>
            <UserButton />
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users..."
              className="w-full rounded-xl border border-slate-300/80 bg-white/80 py-2 pl-9 pr-3 text-sm text-slate-800 outline-none ring-sky-500/25 transition focus:border-sky-500 focus:ring-4"
            />
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-3">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              People
            </p>
            {isUsersLoading ? (
              <SidebarSkeletonRows count={4} />
            ) : users.length === 0 ? (
              <p className="rounded-xl border border-slate-200/80 bg-white/80 p-3 text-sm text-slate-500">
                No search results.
              </p>
            ) : (
              <div className="space-y-1">
                {users.map((u) => (
                  <button
                    key={u._id}
                    onClick={() => void openFromUser(u)}
                    className="group flex w-full items-center justify-between rounded-xl border border-transparent bg-white/55 p-2.5 text-left transition hover:border-slate-200 hover:bg-white"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900 group-hover:text-sky-700">
                        {u.name}
                      </p>
                    </div>
                    <span
                      className={`h-2.5 w-2.5 rounded-full ring-4 ring-white ${
                        isUserOnline(u.lastSeen, now) ? "bg-emerald-500" : "bg-slate-300"
                      }`}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Conversations
            </p>
            {isConversationsLoading ? (
              <SidebarSkeletonRows count={5} />
            ) : conversations.length === 0 ? (
              <p className="rounded-xl border border-slate-200/80 bg-white/80 p-3 text-sm text-slate-500">
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
                    className={`w-full rounded-xl border p-2.5 text-left transition ${
                      activeConversationId === c._id
                        ? "border-sky-200 bg-gradient-to-r from-sky-50 to-cyan-50 shadow-sm"
                        : "border-transparent bg-white/55 hover:border-slate-200 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {c.otherUserName}
                      </p>
                      {c.unreadCount > 0 && (
                        <span className="rounded-full bg-gradient-to-r from-sky-600 to-cyan-600 px-2 py-0.5 text-xs font-medium text-white">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-slate-600">
                      {c.lastMessageText || "No messages yet"}
                    </p>
                    {c.lastMessageAt > 0 && (
                      <p className="mt-1 text-[11px] font-medium text-slate-400">
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

      {/* Chat area: active conversation on desktop, full screen on mobile */}
      <section
        className={`${showChatOnMobile ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col bg-transparent`}
      >
        {activeConversationId ? (
          <ChatPanel
            conversationId={activeConversationId}
            title={title}
            isOnline={online}
            onBack={() => setActiveConversationId(null)}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6">
            <div className="rounded-2xl border border-white/70 bg-white/80 px-6 py-5 text-center text-sm text-slate-600 shadow-xl shadow-slate-900/5 backdrop-blur">
              Select a user or conversation to start chatting.
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
