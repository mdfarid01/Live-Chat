import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

function makeKey(a: Id<"users">, b: Id<"users">) {
  return [String(a), String(b)].sort().join("|");
}

async function me(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .unique();
  if (!user) throw new Error("Profile missing");
  return user;
}
async function meOrNull(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .unique();
}

async function upsertRead(
  ctx: MutationCtx,
  conversationId: Id<"conversations">,
  userId: Id<"users">,
  lastReadAt: number
) {
  const row = await ctx.db
    .query("conversationReads")
    .withIndex("by_conversation_user", (q) =>
      q.eq("conversationId", conversationId).eq("userId", userId)
    )
    .unique();

  if (row) return ctx.db.patch(row._id, { lastReadAt });
  return ctx.db.insert("conversationReads", { conversationId, userId, lastReadAt });
}

export const getOrCreate = mutation({
  args: { otherUserId: v.id("users") },
  handler: async (ctx, args) => {
    const current = await me(ctx);
    if (current._id === args.otherUserId) throw new Error("Cannot message yourself");
    const key = makeKey(current._id, args.otherUserId);

    const existing = await ctx.db
      .query("conversations")
      .withIndex("by_participantKey", (q) => q.eq("participantKey", key))
      .unique();

    if (existing) return existing._id;

    const id = await ctx.db.insert("conversations", {
      participantIds: [current._id, args.otherUserId].sort((a, b) =>
        String(a).localeCompare(String(b))
      ) as Id<"users">[],
      participantKey: key,
      updatedAt: Date.now(),
    });

    await upsertRead(ctx, id, current._id, 0);
    await upsertRead(ctx, id, args.otherUserId, 0);
    return id;
  },
});

export const markAsRead = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const current = await me(ctx);
    await upsertRead(ctx, args.conversationId, current._id, Date.now());
  },
});

export const listForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    
    const current = await meOrNull(ctx);
    if (!current) return [];
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_updatedAt")
      .order("desc")
      .collect();

    const mine = conversations.filter((c) => c.participantIds.includes(current._id));
    const out = [];

    for (const c of mine) {
      const otherId = c.participantIds.find((id) => id !== current._id);
      if (!otherId) continue;

      const other = await ctx.db.get(otherId);
      if (!other) continue;

      const read = await ctx.db
        .query("conversationReads")
        .withIndex("by_conversation_user", (q) =>
          q.eq("conversationId", c._id).eq("userId", current._id)
        )
        .unique();

      const unread = await ctx.db
        .query("messages")
        .withIndex("by_conversationId_createdAt", (q) =>
          q.eq("conversationId", c._id).gt("createdAt", read?.lastReadAt ?? 0)
        )
        .collect();

      out.push({
        _id: c._id,
        otherUserId: other._id,
        otherUserName: other.name,
        otherUserImageUrl: other.imageUrl,
        otherUserLastSeen: other.lastSeen,
        lastMessageText: c.lastMessageText ?? "",
        lastMessageAt: c.lastMessageAt ?? 0,
        unreadCount: unread.filter((m) => m.senderId !== current._id).length,
      });
    }

    return out;
  },
});
