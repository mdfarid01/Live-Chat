"use client";

import { useEffect } from "react";
import { useMutation } from "convex/react";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton, useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import { ChatShell } from "@/components/chat/chat-shell";

function SessionSync() {
  const { isLoaded, user } = useUser();
  const syncCurrentUser = useMutation(api.users.syncCurrentUser);
  const heartbeat = useMutation(api.users.heartbeat);

  useEffect(() => {
    if (!isLoaded || !user) return;

    void syncCurrentUser({
      name: user.fullName ?? user.username ?? "User",
      email: user.primaryEmailAddress?.emailAddress,
      imageUrl: user.imageUrl ?? undefined,
    });

    void heartbeat();
    const id = setInterval(() => void heartbeat(), 15000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void heartbeat();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isLoaded, user, syncCurrentUser, heartbeat]);

  return null;
}

export default function Home() {
  return (
    <main className="h-[100dvh]">
      <AuthLoading>
        <div className="flex h-full items-center justify-center">Loading...</div>
      </AuthLoading>

      <Unauthenticated>
        <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700 p-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-8">
            <h1 className="mb-2 text-2xl font-semibold">Live Chat</h1>
            <p className="mb-6 text-sm text-slate-600">Sign in or sign up to continue.</p>
            <SignInButton mode="modal">
              <button className="w-full rounded-lg bg-slate-900 px-4 py-2 text-white">
                Continue
              </button>
            </SignInButton>
          </div>
        </div>
      </Unauthenticated>

      <Authenticated>
        <SessionSync />
        <ChatShell />
      </Authenticated>
    </main>
  );
}
