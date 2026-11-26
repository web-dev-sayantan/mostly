import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";

export const DEFAULT_DEV_AUTH_EMAIL = "dev@mostly.local";
export const DEFAULT_DEV_AUTH_NAME = "Local Dev";

export interface DevAuthEnv {
  NODE_ENV?: string;
  DEV_AUTH_ENABLED?: string | boolean;
  DEV_AUTH_EMAIL?: string;
  DEV_AUTH_NAME?: string;
}

export interface DevAuthAccount {
  email: string;
  name: string;
}

const emailSchema = z.email();

const isEnabledFlag = (value: string | boolean | undefined): boolean => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value.trim().toLowerCase() === "true";
  }
  return false;
};

/**
 * Resolves the configured local development account, or returns null when local
 * dev auth is disabled. Refuses to activate when NODE_ENV is "production".
 */
export const resolveDevAuthAccount = (env: DevAuthEnv): DevAuthAccount | null => {
  if (env.NODE_ENV === "production") {
    return null;
  }

  if (!isEnabledFlag(env.DEV_AUTH_ENABLED)) {
    return null;
  }

  const rawEmail = env.DEV_AUTH_EMAIL?.trim() || DEFAULT_DEV_AUTH_EMAIL;
  const email = rawEmail.toLowerCase();
  if (!emailSchema.safeParse(email).success) {
    throw new Error(`Invalid DEV_AUTH_EMAIL "${rawEmail}". Provide a valid email address.`);
  }

  const name = env.DEV_AUTH_NAME?.trim() || DEFAULT_DEV_AUTH_NAME;
  return { email, name };
};

/**
 * Development-only Better Auth plugin exposing POST /api/auth/dev/sign-in.
 * Creates or reuses the configured local user and issues a real Better Auth
 * session cookie so all downstream auth, RPC, onboarding, and sign-out flows
 * behave identically to social login.
 */
export const localDevAuthPlugin = (account: DevAuthAccount): BetterAuthPlugin => ({
  id: "local-dev-auth",
  endpoints: {
    devSignIn: createAuthEndpoint(
      "/dev/sign-in",
      {
        method: "POST",
      },
      async (ctx) => {
        const email = account.email.trim().toLowerCase();
        const name = account.name.trim() || DEFAULT_DEV_AUTH_NAME;

        const existing = await ctx.context.internalAdapter.findUserByEmail(email);

        let targetUser = existing?.user ?? null;

        if (targetUser) {
          if (targetUser.name !== name || !targetUser.emailVerified) {
            targetUser =
              (await ctx.context.internalAdapter.updateUser(targetUser.id, {
                name,
                emailVerified: true,
              })) ?? targetUser;
          }
        } else {
          targetUser = await ctx.context.internalAdapter.createUser(
            {
              email,
              name,
              emailVerified: true,
            },
            { method: "local-dev-auth" },
          );
        }

        if (!targetUser) {
          throw APIError.fromStatus("INTERNAL_SERVER_ERROR", {
            message: "Could not create local development user.",
          });
        }

        const session = await ctx.context.internalAdapter.createSession(targetUser.id);
        if (!session) {
          throw APIError.fromStatus("INTERNAL_SERVER_ERROR", {
            message: "Could not create local development session.",
          });
        }

        await setSessionCookie(ctx, {
          session,
          user: targetUser,
        });

        return ctx.json({
          token: session.token,
          user: {
            id: targetUser.id,
            email: targetUser.email,
            name: targetUser.name,
          },
        });
      },
    ),
  },
});
