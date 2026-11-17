import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import type { Database } from "@mostly/db";
import * as schema from "@mostly/db/schema/auth";
import { betterAuth } from "better-auth";

export interface AuthConfig {
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  CORS_ORIGIN: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
}

export const createAuth = (
  env: AuthConfig,
  database: Database,
  desktopOrigins: readonly string[] = []
) => {
  const authUrl = new URL(env.BETTER_AUTH_URL);
  const isLocalHttp =
    authUrl.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(authUrl.hostname);

  return betterAuth({
    database: drizzleAdapter(database, {
      provider: "sqlite",
      schema,
    }),
    session: { modelName: "authSession" },
    trustedOrigins: [env.CORS_ORIGIN, ...desktopOrigins],
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        scope: ["openid", "email", "profile"],
      },
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    advanced: {
      useSecureCookies: !isLocalHttp,
      defaultCookieAttributes: {
        sameSite: isLocalHttp ? "lax" : "none",
        secure: !isLocalHttp,
        httpOnly: true,
      },
    },
    plugins: [],
  });
};

export type Session = ReturnType<typeof createAuth>["$Infer"]["Session"];
