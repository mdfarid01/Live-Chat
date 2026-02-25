import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

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

async function assertMember(
  ctx: QueryCtx | MutationCtx,
  conversationId: Id<"conversations">,
  userId: Id<"users">
) {
  const c = await ctx.db.get(conversationId);
  if (!c || !c.participantIds.includes(userId)) throw new Error("Forbidden");
}

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
      out.push({
        _id: m._id,
        body: m.body,
        createdAt: m.createdAt,
        senderName: sender?.name ?? "Unknown",
        isMine: m.senderId === current._id,
      });
    }
    return out;
  },
});

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
