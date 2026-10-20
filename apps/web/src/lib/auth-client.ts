import { createAuthClient } from "better-auth/react";

import { ENV } from "../env.public";

export const authClient = createAuthClient({
  baseURL: ENV.VITE_SERVER_URL,
});

/**
 * Start Google sign-in and return to the app's start URL. iOS standalone PWAs
 * hand OAuth to the system browser and cannot keep that browser's cookies for
 * certain, so `/today` is the return path: the flow completes in the browser,
 * and the installed app can be reopened from there.
 */
export async function signInWithGoogle() {
  const { origin } = window.location;
  const { data, error } = await authClient.signIn.social({
    provider: "google",
    callbackURL: `${origin}/today`,
    errorCallbackURL: `${origin}/login`,
    disableRedirect: true,
  });

  if (error) {
    throw new Error(error.message || "Could not start Google sign-in");
  }
  if (!data?.url) {
    throw new Error("Google sign-in did not return a redirect URL");
  }

  window.location.assign(data.url);
}
