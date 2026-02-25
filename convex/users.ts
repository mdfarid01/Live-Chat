import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const syncCurrentUser = mutation({
  args: {
    name: v.string(),
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const now = Date.now();
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, lastSeen: now });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      clerkId: identity.subject,
      ...args,
      lastSeen: now,
    });
  },
});

export const heartbeat = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const me = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!me) return null;
    await ctx.db.patch(me._id, { lastSeen: Date.now() });
    return me._id;
  },
});

export const list = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const me = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!me) return [];

    const search = (args.search ?? "").trim().toLowerCase();
    const users = await ctx.db.query("users").withIndex("by_name").collect();

    return users
      .filter((u) => u._id !== me._id)
      .filter((u) => (search ? u.name.toLowerCase().includes(search) : true))
      .slice(0, 50)
      .map((u) => ({
        _id: u._id,
        name: u.name,
        imageUrl: u.imageUrl,
        lastSeen: u.lastSeen,
      }));
  },
});
