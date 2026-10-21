import { createAuthClient } from "better-auth/react";

import { ENV } from "../env.public";

export const authClient = createAuthClient({
  baseURL: ENV.VITE_SERVER_URL,
});

/**
 * Start Google sign-in and return to onboarding. A completed account is sent
 * straight to Today; a new one picks goals and a reminder first.
 */
export const signInWithGoogle = async () => {
  const { origin } = window.location;
  const { data, error } = await authClient.signIn.social({
    provider: "google",
    callbackURL: `${origin}/onboarding`,
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
};
