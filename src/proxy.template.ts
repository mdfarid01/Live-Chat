import { clerkMiddleware } from "@clerk/nextjs/server";

// Restore file for Next.js 16+.
// To re-enable auth edge protection after incident recovery:
// 1) Rename this file to `proxy.ts`.
// 2) Remove `middleware.disabled.ts` (or keep it disabled).
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
