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

export const setTyping = mutation({
  args: { conversationId: v.id("conversations"), isTyping: v.boolean() },
  handler: async (ctx, args) => {
    const current = await me(ctx);
    await assertMember(ctx, args.conversationId, current._id);

    const row = await ctx.db
      .query("typingStates")
      .withIndex("by_conversation_user", (q) =>
        q.eq("conversationId", args.conversationId).eq("userId", current._id)
      )
      .unique();

    if (!args.isTyping) {
      if (row) await ctx.db.delete(row._id);
      return;
    }

    const expiresAt = Date.now() + 2000;
    if (row) return ctx.db.patch(row._id, { expiresAt });

    await ctx.db.insert("typingStates", {
      conversationId: args.conversationId,
      userId: current._id,
      expiresAt,
    });
  },
});

export const getOtherTyping = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const current = await me(ctx);
    await assertMember(ctx, args.conversationId, current._id);

    const rows = await ctx.db
      .query("typingStates")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();

    const other = rows.find((r) => r.userId !== current._id);
    if (!other) return null;

    const user = await ctx.db.get(other.userId);
    if (!user) return null;

    return { name: user.name, expiresAt: other.expiresAt };
  },
});
