import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import type { Database } from "@mostly/db";
import * as schema from "@mostly/db/schema/auth";
import { betterAuth } from "better-auth";
import type { BetterAuthPlugin } from "better-auth";

export interface AuthConfig {
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  CORS_ORIGIN: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

export interface CreateAuthOptions {
  desktopOrigins?: readonly string[];
  plugins?: readonly BetterAuthPlugin[];
}

export const createAuth = (
  env: AuthConfig,
  database: Database,
  options: CreateAuthOptions = {},
) => {
  const desktopOrigins = options.desktopOrigins ?? [];
  const plugins = options.plugins ? [...options.plugins] : [];
  const googleClientId = env.GOOGLE_CLIENT_ID?.trim() ?? "";
  const googleClientSecret = env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
  const hasGoogle = googleClientId.length > 0 && googleClientSecret.length > 0;

  if (!hasGoogle && plugins.length === 0) {
    throw new Error(
      "Google OAuth credentials (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET) are required.",
    );
  }

  const authUrl = new URL(env.BETTER_AUTH_URL);
  const isLocalHttp =
    authUrl.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(authUrl.hostname);

  return betterAuth({
    database: drizzleAdapter(database, {
      provider: "sqlite",
      schema,
    }),
    session: { modelName: "authSession" },
    trustedOrigins: [env.CORS_ORIGIN, ...desktopOrigins],
    ...(hasGoogle
      ? {
          socialProviders: {
            google: {
              clientId: googleClientId,
              clientSecret: googleClientSecret,
              scope: ["openid", "email", "profile"],
            },
          },
        }
      : {}),
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
    plugins,
  });
};

export type AuthInstance = ReturnType<typeof createAuth>;
export type Session = AuthInstance["$Infer"]["Session"];
