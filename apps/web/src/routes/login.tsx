import { Button } from "@mostly/ui/components/button";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";

import { authClient, signInWithGoogle } from "@/lib/auth-client";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { error?: string } => ({
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (session.data) {
      throw redirect({ to: "/today" });
    }
  },
  component: SignInPage,
});

function SignInPage() {
  const { error: callbackError } = Route.useSearch();
  const [status, setStatus] = useState<"idle" | "opening">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setStatus("opening");
    setError(null);

    try {
      await signInWithGoogle();
    } catch (error) {
      setStatus("idle");
      setError(error instanceof Error ? error.message : "Could not sign in with Google.");
    }
  }

  const message = error ?? (callbackError ? "Sign-in didn't complete. Try again." : null);

  return (
    <main className="grid min-h-svh place-items-center px-6 py-10">
      <div className="w-full max-w-sm text-center">
        <img src="/icon.svg" alt="" className="mx-auto size-12 rounded-xl" />
        <h1 className="mt-5 text-2xl font-medium">Sign in to Mostly</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Your goals stay yours. No social feed, no sharing.
        </p>

        <Button
          className="mt-8 min-h-11 w-full rounded-full text-sm"
          disabled={status === "opening"}
          onClick={handleSignIn}
        >
          {status === "opening" ? "Opening Google…" : "Continue with Google"}
        </Button>

        {message ? (
          <p role="alert" className="text-destructive mt-4 text-sm">
            {message}
          </p>
        ) : null}

        <p className="text-muted-foreground mt-8 text-sm">A quiet record of what you did.</p>
      </div>
    </main>
  );
}
