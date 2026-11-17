import { createAuthClient } from "better-auth/react";

import { ENV } from "../env.public";

export const authClient = createAuthClient({
  baseURL: ENV.VITE_SERVER_URL,
});

export const signInWithGoogle = async () => {
  const { origin } = window.location;
  const { data, error } = await authClient.signIn.social({
    provider: "google",
    callbackURL: `${origin}/today`,
    errorCallbackURL: `${origin}/`,
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
