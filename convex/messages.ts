import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

// Allowed reaction set.
const reactionEmoji = v.union(
  v.literal("👍"),
  v.literal("❤️"),
  v.literal("😂"),
  v.literal("😮"),
  v.literal("😢")
);

type ReactionEmoji = "👍" | "❤️" | "😂" | "😮" | "😢";
const REACTION_ORDER: ReactionEmoji[] = ["👍", "❤️", "😂", "😮", "😢"];

// Strict auth helper that resolves the current app user.
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

// Ensures a user can only access messages for conversations they belong to.
async function assertMember(
  ctx: QueryCtx | MutationCtx,
  conversationId: Id<"conversations">,
  userId: Id<"users">
) {
  const c = await ctx.db.get(conversationId);
  if (!c || !c.participantIds.includes(userId)) throw new Error("Forbidden");
  return c;
}

// Returns ordered messages for a conversation with sender metadata + reactions.
export const list = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const current = await me(ctx);
    await assertMember(ctx, args.conversationId, current._id);

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversationId_createdAt", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("asc")
      .collect();

    const out = [];
    for (const m of messages) {
      const sender = await ctx.db.get(m.senderId);
      const reactionRows = await ctx.db
        .query("messageReactions")
        .withIndex("by_message", (q) => q.eq("messageId", m._id))
        .collect();

      const reactionMap = new Map<
        ReactionEmoji,
        { emoji: ReactionEmoji; count: number; reactedByMe: boolean }
      >();

      for (const emoji of REACTION_ORDER) {
        reactionMap.set(emoji, { emoji, count: 0, reactedByMe: false });
      }

      for (const r of reactionRows) {
        const entry = reactionMap.get(r.emoji as ReactionEmoji);
        if (!entry) continue;
        entry.count += 1;
        if (r.userId === current._id) entry.reactedByMe = true;
      }

      out.push({
        _id: m._id,
        body: m.body,
        createdAt: m.createdAt,
        deletedAt: m.deletedAt,
        senderName: sender?.name ?? "Unknown",
        isMine: m.senderId === current._id,
        reactions: REACTION_ORDER.map((emoji) => reactionMap.get(emoji)!),
      });
    }

    return out;
  },
});

// Sends a message and updates the conversation preview fields.
export const send = mutation({
  args: {
    conversationId: v.id("conversations"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const current = await me(ctx);
    await assertMember(ctx, args.conversationId, current._id);

    const body = args.body.trim();
    if (!body) throw new Error("Empty message");

    const now = Date.now();
    const id = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: current._id,
      body,
      createdAt: now,
    });

    await ctx.db.patch(args.conversationId, {
      updatedAt: now,
      lastMessageText: body,
      lastMessageAt: now,
      lastMessageSenderId: current._id,
    });

    return id;
  },
});

// Feature 11: sender can soft-delete their own message.
export const deleteOwn = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const current = await me(ctx);
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");

    const conversation = await assertMember(ctx, message.conversationId, current._id);
    if (message.senderId !== current._id) throw new Error("Forbidden");
    if (message.deletedAt) return;

    await ctx.db.patch(args.messageId, { deletedAt: Date.now() });

    // Keep sidebar preview realistic if latest message was deleted.
    if (
      conversation.lastMessageAt === message.createdAt &&
      conversation.lastMessageSenderId === current._id
    ) {
      await ctx.db.patch(message.conversationId, {
        lastMessageText: "This message was deleted",
      });
    }
  },
});

// Feature 12: toggle/update one reaction per user per message.
export const toggleReaction = mutation({
  args: {
    messageId: v.id("messages"),
    emoji: reactionEmoji,
  },
  handler: async (ctx, args) => {
    const current = await me(ctx);
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");

    await assertMember(ctx, message.conversationId, current._id);

    const existing = await ctx.db
      .query("messageReactions")
      .withIndex("by_message_user", (q) =>
        q.eq("messageId", args.messageId).eq("userId", current._id)
      )
      .unique();

    if (!existing) {
      await ctx.db.insert("messageReactions", {
        messageId: args.messageId,
        userId: current._id,
        emoji: args.emoji,
        createdAt: Date.now(),
      });
      return;
    }

    // Same emoji => remove (toggle off), different emoji => replace.
    if (existing.emoji === args.emoji) {
      await ctx.db.delete(existing._id);
      return;
    }

    await ctx.db.patch(existing._id, {
      emoji: args.emoji,
      createdAt: Date.now(),
    });
  },
});
