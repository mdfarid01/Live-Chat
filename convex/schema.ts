import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Central Convex schema for users, DMs, read receipts, typing presence, and reactions.
const reactionEmoji = v.union(
  v.literal("👍"),
  v.literal("❤️"),
  v.literal("😂"),
  v.literal("😮"),
  v.literal("😢")
);

export default defineSchema({
  // App profile records mirrored from Clerk so users can discover each other.
  users: defineTable({
    clerkId: v.string(),
    name: v.string(),
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    lastSeen: v.number(),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_name", ["name"]),

  // One row per 1:1 conversation.
  conversations: defineTable({
    participantIds: v.array(v.id("users")),
    participantKey: v.string(),
    isGroup: v.optional(v.boolean()),
    groupName: v.optional(v.string()),
    groupCreatedBy: v.optional(v.id("users")),
    updatedAt: v.number(),
    lastMessageText: v.optional(v.string()),
    lastMessageAt: v.optional(v.number()),
    lastMessageSenderId: v.optional(v.id("users")),
  })
    .index("by_participantKey", ["participantKey"])
    .index("by_updatedAt", ["updatedAt"]),

  // Message timeline for each conversation.
  messages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.id("users"),
    body: v.string(),
    createdAt: v.number(),
    // Soft delete marker: message stays in DB.
    deletedAt: v.optional(v.number()),
  }).index("by_conversationId_createdAt", ["conversationId", "createdAt"]),

  // Last read timestamp per (conversation, user) pair.
  conversationReads: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    lastReadAt: v.number(),
  })
    .index("by_conversation_user", ["conversationId", "userId"])
    .index("by_user", ["userId"]),

  // Ephemeral typing state with short expiration.
  typingStates: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    expiresAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_conversation_user", ["conversationId", "userId"]),

  // One reaction per user per message (toggle/update behavior).
  messageReactions: defineTable({
    messageId: v.id("messages"),
    userId: v.id("users"),
    emoji: reactionEmoji,
    createdAt: v.number(),
  })
    .index("by_message", ["messageId"])
    .index("by_message_user", ["messageId", "userId"]),
});
