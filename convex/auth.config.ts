import { AuthConfig } from "convex/server";

const authConfig: AuthConfig = {
  providers: [
    {
      domain: "https://enhanced-penguin-1.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
};

export default authConfig;
