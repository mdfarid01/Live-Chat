"use client";

import { useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton, useUser } from "@clerk/nextjs";
import { MessageCircleMore, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { ChatShell } from "@/components/chat/chat-shell";

function SessionSync({ onReady }: { onReady: (userId: string) => void }) {

const { isLoaded, user } = useUser();
  const syncCurrentUser = useMutation(api.users.syncCurrentUser);
  const heartbeat = useMutation(api.users.heartbeat);

  useEffect(() => {
    if (!isLoaded || !user) return;

    let cancelled = false;
    const start = async () => {
      await syncCurrentUser({
        name: user.fullName ?? user.username ?? "User",
        email: user.primaryEmailAddress?.emailAddress,
        imageUrl: user.imageUrl ?? undefined,
      });
      if (!cancelled) onReady(user.id);
      await heartbeat();
    };

    void start();
    const id = setInterval(() => void heartbeat(), 15000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void heartbeat();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
   }, [isLoaded, user, syncCurrentUser, heartbeat, onReady]);


  return null;
}

export default function Home() {
   const { user } = useUser();
  const [readyForUserId, setReadyForUserId] = useState<string | null>(null);
  const activeUserId = user?.id ?? null;
  const isProfileReady = activeUserId !== null && readyForUserId === activeUserId;
  return (
    <main className="h-[100dvh]">
      <AuthLoading>
        <div className="flex h-full items-center justify-center">Loading...</div>
      </AuthLoading>

      <Unauthenticated>
       <div className="relative flex h-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_20%_20%,_#1d4ed8_0%,_#0f172a_40%,_#020617_100%)] p-6">
          <div className="pointer-events-none absolute -left-10 top-20 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl animate-pulse" />
          <div className="pointer-events-none absolute -right-12 bottom-10 h-72 w-72 rounded-full bg-indigo-400/20 blur-3xl animate-pulse" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:36px_36px] [mask-image:radial-gradient(circle_at_center,black,transparent_75%)]" />

          <div className="relative z-10 grid w-full max-w-5xl gap-6 rounded-3xl border border-white/20 bg-white/10 p-4 shadow-2xl shadow-black/30 backdrop-blur-2xl md:grid-cols-2 md:p-7">
            <div className="rounded-2xl border border-white/15 bg-gradient-to-br from-slate-950/80 to-slate-900/40 p-6 text-white">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/40 bg-cyan-400/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-100">
                <Sparkles className="h-3.5 w-3.5" />
                Realtime Messenger
              </div>

              <h1 className="text-3xl font-semibold leading-tight md:text-4xl">
                Live Chat
                <span className="block bg-gradient-to-r from-cyan-300 to-indigo-300 bg-clip-text text-transparent">
                  Private. Fast. Beautiful.
                </span>
              </h1>

              <p className="mt-3 text-sm text-slate-300">
                One-on-one conversations with typing indicators, unread badges, reactions, and instant updates.
              </p>

              <div className="mt-5 grid gap-2 text-xs sm:grid-cols-3">
                <div className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-slate-200">
                  <Zap className="mb-1 h-3.5 w-3.5 text-cyan-300" />
                  Real-time sync
                </div>
                <div className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-slate-200">
                  <ShieldCheck className="mb-1 h-3.5 w-3.5 text-cyan-300" />
                  Secure auth
                </div>
                <div className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-slate-200">
                  <MessageCircleMore className="mb-1 h-3.5 w-3.5 text-cyan-300" />
                  Smart inbox
                </div>
              </div>

              <div className="mt-6">
                <SignInButton mode="modal">
                  <button className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:brightness-110">
                    Continue
                  </button>
                </SignInButton>
              </div>
            </div>

            <div className="hidden rounded-2xl border border-white/20 bg-white/90 p-4 shadow-xl md:block">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Preview
              </p>
              <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    Hey, are we shipping tonight?
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl bg-gradient-to-r from-sky-600 to-cyan-600 px-3 py-2 text-sm text-white">
                    Yes. Final QA in 20 mins.
                  </div>
                </div>
                <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:300ms]" />
                  Alex is typing
                </div>
              </div>
            </div>
          </div>
        </div>
      </Unauthenticated>

      <Authenticated>
         <SessionSync onReady={(userId) => setReadyForUserId(userId)} />
        {isProfileReady ? (
          <ChatShell />
        ) : (
          <div className="flex h-full items-center justify-center">Preparing your profile...</div>
        )}
      </Authenticated>
    </main>
  );
}
