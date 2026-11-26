import { createTestDb } from "@mostly/db/testing";
import { describe, expect, it } from "vite-plus/test";

import {
  DEFAULT_DEV_AUTH_EMAIL,
  DEFAULT_DEV_AUTH_NAME,
  localDevAuthPlugin,
  resolveDevAuthAccount,
} from "./dev";
import { createAuth } from "./index";
import type { AuthConfig } from "./index";

const baseConfig: AuthConfig = {
  BETTER_AUTH_URL: "http://localhost:3003",
  BETTER_AUTH_SECRET: "test-secret-that-is-long-enough-to-pass",
  CORS_ORIGIN: "http://localhost:3003",
};

const extractCookiePair = (response: Response): string => {
  const setCookie = response.headers.get("set-cookie");
  expect(setCookie).toBeTruthy();
  const [pair] = (setCookie ?? "").split(";");
  return pair ?? "";
};

describe("resolveDevAuthAccount", () => {
  it("returns null when DEV_AUTH_ENABLED is unset or false", () => {
    expect(resolveDevAuthAccount({})).toBeNull();
    expect(resolveDevAuthAccount({ DEV_AUTH_ENABLED: false })).toBeNull();
    expect(resolveDevAuthAccount({ DEV_AUTH_ENABLED: "false" })).toBeNull();
    expect(resolveDevAuthAccount({ DEV_AUTH_ENABLED: "0" })).toBeNull();
  });

  it("returns null in production even if DEV_AUTH_ENABLED is true", () => {
    expect(
      resolveDevAuthAccount({
        NODE_ENV: "production",
        DEV_AUTH_ENABLED: true,
        DEV_AUTH_EMAIL: "dev@mostly.local",
        DEV_AUTH_NAME: "Local Dev",
      }),
    ).toBeNull();
    expect(
      resolveDevAuthAccount({
        NODE_ENV: "production",
        DEV_AUTH_ENABLED: "true",
      }),
    ).toBeNull();
  });

  it("uses defaults when enabled without custom email or name", () => {
    expect(
      resolveDevAuthAccount({
        NODE_ENV: "development",
        DEV_AUTH_ENABLED: "true",
      }),
    ).toEqual({
      email: DEFAULT_DEV_AUTH_EMAIL,
      name: DEFAULT_DEV_AUTH_NAME,
    });
  });

  it("normalizes custom email and trims name", () => {
    expect(
      resolveDevAuthAccount({
        NODE_ENV: "development",
        DEV_AUTH_ENABLED: " TRUE ",
        DEV_AUTH_EMAIL: "  Agent@Mostly.Local ",
        DEV_AUTH_NAME: "  QA Agent  ",
      }),
    ).toEqual({
      email: "agent@mostly.local",
      name: "QA Agent",
    });
  });

  it("throws when DEV_AUTH_EMAIL is not a valid email", () => {
    expect(() =>
      resolveDevAuthAccount({
        NODE_ENV: "development",
        DEV_AUTH_ENABLED: true,
        DEV_AUTH_EMAIL: "not-an-email",
      }),
    ).toThrow(/Invalid DEV_AUTH_EMAIL/u);
  });
});

describe("localDevAuthPlugin", () => {
  it("signs in the configured local account without Google credentials", async () => {
    const { db, close } = await createTestDb();

    try {
      const auth = createAuth(baseConfig, db, {
        plugins: [
          localDevAuthPlugin({
            email: "agent@mostly.local",
            name: "QA Agent",
          }),
        ],
      });

      const signInResponse = await auth.handler(
        new Request("http://localhost:3003/api/auth/dev/sign-in", {
          method: "POST",
          headers: { origin: "http://localhost:3003" },
        }),
      );

      expect(signInResponse.status).toBe(200);
      const body = (await signInResponse.json()) as {
        token: string;
        user: { id: string; email: string; name: string };
      };
      expect(body.token).toBeTruthy();
      expect(body.user).toMatchObject({
        email: "agent@mostly.local",
        name: "QA Agent",
      });

      const cookie = extractCookiePair(signInResponse);
      const sessionResponse = await auth.handler(
        new Request("http://localhost:3003/api/auth/get-session", {
          headers: { cookie },
        }),
      );

      expect(sessionResponse.status).toBe(200);
      const sessionBody = (await sessionResponse.json()) as {
        user: { id: string; email: string; name: string };
      };
      expect(sessionBody.user).toMatchObject({
        id: body.user.id,
        email: "agent@mostly.local",
        name: "QA Agent",
      });

      const signOutResponse = await auth.handler(
        new Request("http://localhost:3003/api/auth/sign-out", {
          method: "POST",
          headers: { cookie, origin: "http://localhost:3003" },
        }),
      );
      expect(signOutResponse.status).toBe(200);

      const afterSignOut = await auth.handler(
        new Request("http://localhost:3003/api/auth/get-session", {
          headers: { cookie },
        }),
      );
      expect(await afterSignOut.json()).toBeNull();
    } finally {
      close();
    }
  });

  it("reuses the same user on repeat sign-ins and updates the display name", async () => {
    const { db, close } = await createTestDb();

    try {
      const firstAuth = createAuth(baseConfig, db, {
        plugins: [
          localDevAuthPlugin({
            email: "dev@mostly.local",
            name: "First Name",
          }),
        ],
      });

      const firstResponse = await firstAuth.handler(
        new Request("http://localhost:3003/api/auth/dev/sign-in", {
          method: "POST",
        }),
      );
      const firstBody = (await firstResponse.json()) as {
        user: { id: string; name: string };
      };

      const secondAuth = createAuth(baseConfig, db, {
        plugins: [
          localDevAuthPlugin({
            email: "dev@mostly.local",
            name: "Renamed Dev",
          }),
        ],
      });

      const secondResponse = await secondAuth.handler(
        new Request("http://localhost:3003/api/auth/dev/sign-in", {
          method: "POST",
        }),
      );
      const secondBody = (await secondResponse.json()) as {
        user: { id: string; name: string };
      };

      expect(secondBody.user.id).toBe(firstBody.user.id);
      expect(secondBody.user.name).toBe("Renamed Dev");
    } finally {
      close();
    }
  });

  it("requires Google credentials when no dev auth plugin is installed", async () => {
    const { db, close } = await createTestDb();

    try {
      expect(() => createAuth(baseConfig, db)).toThrow(/Google OAuth credentials/u);
    } finally {
      close();
    }
  });

  it("does not expose /api/auth/dev/sign-in without the plugin", async () => {
    const { db, close } = await createTestDb();

    try {
      const auth = createAuth(
        {
          ...baseConfig,
          GOOGLE_CLIENT_ID: "google-client-id",
          GOOGLE_CLIENT_SECRET: "google-client-secret",
        },
        db,
      );

      const response = await auth.handler(
        new Request("http://localhost:3003/api/auth/dev/sign-in", {
          method: "POST",
        }),
      );

      expect(response.status).toBe(404);
    } finally {
      close();
    }
  });
});
