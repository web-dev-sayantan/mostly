import { createTestDb } from "@mostly/db/testing";
import { describe, expect, it } from "vite-plus/test";

import { createAuth } from "./index";
import type { AuthConfig } from "./index";

const config: AuthConfig = {
  BETTER_AUTH_URL: "http://localhost:3004",
  BETTER_AUTH_SECRET: "test-secret-that-is-long-enough-to-pass",
  CORS_ORIGIN: "http://localhost:3003",
  GOOGLE_CLIENT_ID: "google-client-id",
  GOOGLE_CLIENT_SECRET: "google-client-secret",
};

describe("createAuth", () => {
  it("offers Google with identity scopes as the only way to sign in", async () => {
    const { db, close } = await createTestDb();

    try {
      const auth = createAuth(config, db);

      expect(Object.keys(auth.options.socialProviders ?? {})).toEqual(["google"]);
      expect(auth.options.socialProviders?.google).toMatchObject({
        clientId: "google-client-id",
        clientSecret: "google-client-secret",
        scope: ["openid", "email", "profile"],
      });
      expect(auth.options).not.toHaveProperty("emailAndPassword");
    } finally {
      close();
    }
  });
});
