import { createAuth as createConfiguredAuth } from "@mostly/auth";
import { createTestDb } from "@mostly/db/testing";
import { describe, expect, it } from "vite-plus/test";

import { createServerApp } from "./app";
import { createDevServerApp } from "./dev-app";

const baseEnv: Env = {
  DATABASE_URL: ":memory:",
  CORS_ORIGIN: "http://localhost:3003",
  BETTER_AUTH_SECRET: "test-secret-that-is-long-enough-to-pass",
  BETTER_AUTH_URL: "http://localhost:3003",
  GOOGLE_CLIENT_ID: "google-client-id",
  GOOGLE_CLIENT_SECRET: "google-client-secret",
  DATABASE_AUTH_TOKEN: "",
  VAPID_PUBLIC_KEY: "",
  VAPID_PRIVATE_KEY: "",
  VAPID_SUBJECT: "",
  REMINDER_RUN_SECRET: "",
};

const extractCookiePair = (response: Response): string => {
  const setCookie = response.headers.get("set-cookie");
  expect(setCookie).toBeTruthy();
  const [pair] = (setCookie ?? "").split(";");
  return pair ?? "";
};

describe("server auth isolation", () => {
  it("does not expose dev auth routes in the production server app", async () => {
    const { db, close } = await createTestDb();

    try {
      const { app } = createServerApp({
        env: baseEnv,
        getDb: () => db,
        createAuth: (database) => Promise.resolve(createConfiguredAuth(baseEnv, database ?? db)),
      });

      const statusResponse = await app.request("/api/auth/dev/status");
      expect(statusResponse.status).toBe(404);

      const signInResponse = await app.request("/api/auth/dev/sign-in", {
        method: "POST",
      });
      expect(signInResponse.status).toBe(404);
    } finally {
      close();
    }
  });

  it("reports dev auth disabled when DEV_AUTH_ENABLED is false", async () => {
    const { db, close } = await createTestDb();

    try {
      const { app } = createDevServerApp({
        env: {
          ...baseEnv,
          DEV_AUTH_ENABLED: "false",
          DEV_AUTH_EMAIL: "dev@mostly.local",
          DEV_AUTH_NAME: "Local Dev",
        },
        getDb: () => db,
      });

      const statusResponse = await app.request("/api/auth/dev/status");
      expect(statusResponse.status).toBe(200);
      expect(statusResponse.headers.get("cache-control")).toBe("no-store");
      expect(await statusResponse.json()).toEqual({
        enabled: false,
        account: null,
        googleEnabled: true,
      });

      const signInResponse = await app.request("/api/auth/dev/sign-in", {
        method: "POST",
      });
      expect(signInResponse.status).toBe(404);
    } finally {
      close();
    }
  });

  it("authenticates end-to-end RPC requests via local dev sign-in without Google credentials", async () => {
    const { db, close } = await createTestDb();

    try {
      const { app } = createDevServerApp({
        env: {
          ...baseEnv,
          GOOGLE_CLIENT_ID: "",
          GOOGLE_CLIENT_SECRET: "",
          DEV_AUTH_ENABLED: "true",
          DEV_AUTH_EMAIL: "agent@mostly.local",
          DEV_AUTH_NAME: "Agent Tester",
        },
        getDb: () => db,
      });

      const statusResponse = await app.request("/api/auth/dev/status");
      expect(statusResponse.status).toBe(200);
      expect(await statusResponse.json()).toEqual({
        enabled: true,
        account: {
          email: "agent@mostly.local",
          name: "Agent Tester",
        },
        googleEnabled: false,
      });

      const signInResponse = await app.request("/api/auth/dev/sign-in", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3003",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
        },
        body: "{}",
      });
      expect(signInResponse.status).toBe(200);
      const cookie = extractCookiePair(signInResponse);

      const rpcResponse = await app.request("/rpc/privateData", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie,
          origin: "http://localhost:3003",
        },
        body: JSON.stringify({ json: null }),
      });
      expect(rpcResponse.status).toBe(200);
      const rpcBody = (await rpcResponse.json()) as {
        json: {
          message: string;
          user: { email: string; name: string };
        };
      };
      expect(rpcBody.json).toMatchObject({
        message: "This is private",
        user: {
          email: "agent@mostly.local",
          name: "Agent Tester",
        },
      });

      const signOutResponse = await app.request("/api/auth/sign-out", {
        method: "POST",
        headers: {
          cookie,
          origin: "http://localhost:3003",
        },
      });
      expect(signOutResponse.status).toBe(200);

      const unauthenticatedRpc = await app.request("/rpc/privateData", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie,
          origin: "http://localhost:3003",
        },
        body: JSON.stringify({ json: null }),
      });
      expect(unauthenticatedRpc.status).toBe(401);
    } finally {
      close();
    }
  });
});
