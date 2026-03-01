"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Plus, Search, Users, X } from "lucide-react";
import { UserButton, useUser } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

import { ChatPanel } from "./chat-panel";
import { formatMessageTimestamp, isUserOnline } from "@/lib/time";

type ActivePreview = {
  title: string;
  isGroup: boolean;
  lastSeen: number;
  memberCount?: number;
};

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
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isCreatingGroupSubmitting, setIsCreatingGroupSubmitting] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<Id<"users">[]>([]);
  const [groupError, setGroupError] = useState<string | null>(null);

  // Realtime sidebar data from Convex.
  const usersQuery = useQuery(api.users.list, { search });
  const groupUsersQuery = useQuery(api.users.list, { search: "" });
  const conversationsQuery = useQuery(api.conversations.listForCurrentUser);
  // Convex query returns `undefined` while loading.
  const users = usersQuery ?? [];
  const groupUsers = groupUsersQuery ?? [];
  const conversations = (conversationsQuery ?? []) as any[];
  const isUsersLoading = usersQuery === undefined;
  const isConversationsLoading = conversationsQuery === undefined;
  const isGroupUsersLoading = groupUsersQuery === undefined;
  const getOrCreate = useMutation(api.conversations.getOrCreate);
  const createGroup = useMutation((api as any).conversations.createGroup);

  // Tick for online/offline indicator recalculation.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  const activeConversation = useMemo(
    () => conversations.find((c: any) => c._id === activeConversationId) ?? null,
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
    setActivePreview({ title: u.name, isGroup: false, lastSeen: u.lastSeen, memberCount: 2 });
    setSearch("");
  };

  const toggleGroupMember = (id: Id<"users">) => {
    setSelectedMemberIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const closeGroupCreator = () => {
    if (isCreatingGroupSubmitting) return;
    setIsCreatingGroup(false);
    setGroupError(null);
  };

  const onCreateGroup = async () => {
    const trimmed = groupName.trim();
    if (!trimmed) {
      setGroupError("Group name is required");
      return;
    }
    if (selectedMemberIds.length < 2) {
      setGroupError("Select at least 2 members");
      return;
    }

    setGroupError(null);
    setIsCreatingGroupSubmitting(true);
    try {
      const conversationId = await createGroup({
        groupName: trimmed,
        memberIds: selectedMemberIds,
      });

      setActiveConversationId(conversationId);
      setActivePreview({
        title: trimmed,
        isGroup: true,
        lastSeen: 0,
        memberCount: selectedMemberIds.length + 1,
      });

      setIsCreatingGroup(false);
      setGroupName("");
      setSelectedMemberIds([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create group";
      setGroupError(message);
    } finally {
      setIsCreatingGroupSubmitting(false);
    }
  };

  const showChatOnMobile = activeConversationId !== null;
  const title = activeConversation?.title ?? activeConversation?.otherUserName ?? activePreview?.title ?? "Conversation";
  const isGroupConversation = Boolean(activeConversation?.isGroup ?? activePreview?.isGroup);
  const memberCount = activeConversation?.memberCount ?? activePreview?.memberCount ?? 0;
  const online =
    !isGroupConversation &&
    isUserOnline(activeConversation?.otherUserLastSeen ?? activePreview?.lastSeen ?? 0, now);
  const statusText = isGroupConversation
    ? `${memberCount} members`
    : online
      ? "Online"
      : "Offline";

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
              Group Chat
            </p>
            <button
              onClick={() => {
                setIsCreatingGroup(true);
                setGroupError(null);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-white"
            >
              <Plus className="h-4 w-4" />
              New group
            </button>
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
                {conversations.map((c: any) => (
                  <button
                    key={c._id}
                    onClick={() => {
                      setActiveConversationId(c._id);
                      setActivePreview({
                        title: c.title ?? c.otherUserName ?? "Conversation",
                        isGroup: Boolean(c.isGroup),
                        lastSeen: c.otherUserLastSeen ?? 0,
                        memberCount: c.memberCount,
                      });
                    }}
                    className={`w-full rounded-xl border p-2.5 text-left transition ${
                      activeConversationId === c._id
                        ? "border-sky-200 bg-gradient-to-r from-sky-50 to-cyan-50 shadow-sm"
                        : "border-transparent bg-white/55 hover:border-slate-200 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {c.title ?? c.otherUserName}
                      </p>
                      {c.unreadCount > 0 && (
                        <span className="rounded-full bg-gradient-to-r from-sky-600 to-cyan-600 px-2 py-0.5 text-xs font-medium text-white">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                    {c.isGroup && (
                      <p className="mt-0.5 text-[11px] font-medium text-sky-700">
                        {c.memberCount} members
                      </p>
                    )}
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
            statusText={statusText}
            showPresenceDot={!isGroupConversation}
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

      {isCreatingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            onClick={closeGroupCreator}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            aria-label="Close group creator"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Create group chat"
            className="relative z-10 w-full max-w-md rounded-2xl border border-white/80 bg-white/95 p-4 shadow-2xl shadow-slate-900/20 backdrop-blur-xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-slate-900">Create Group</p>
                <p className="text-xs text-slate-500">Choose a name and at least 2 members.</p>
              </div>
              <button
                type="button"
                onClick={closeGroupCreator}
                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Project Team"
                className="w-full rounded-xl border border-slate-300/80 px-3 py-2.5 text-sm text-slate-800 outline-none ring-sky-500/25 transition focus:border-sky-500 focus:ring-4"
              />

              <div className="flex items-center justify-between text-xs text-slate-500">
                <p>Members</p>
                <p>{selectedMemberIds.length} selected</p>
              </div>

              <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
                {isGroupUsersLoading ? (
                  <p className="px-2 py-1 text-xs text-slate-500">Loading users...</p>
                ) : groupUsers.length === 0 ? (
                  <p className="px-2 py-1 text-xs text-slate-500">No users available.</p>
                ) : (
                  groupUsers.map((u) => (
                    <label
                      key={u._id}
                      className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 transition hover:bg-slate-100"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedMemberIds.includes(u._id)}
                          onChange={() => toggleGroupMember(u._id)}
                        />
                        <span className="text-sm text-slate-700">{u.name}</span>
                      </div>
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                    </label>
                  ))
                )}
              </div>

              {groupError && (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700">
                  {groupError}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeGroupCreator}
                  disabled={isCreatingGroupSubmitting}
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void onCreateGroup()}
                  disabled={isCreatingGroupSubmitting}
                  className="flex-1 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 px-3 py-2 text-sm font-medium text-white shadow-md shadow-sky-500/25 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCreatingGroupSubmitting ? "Creating..." : "Create Group"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
