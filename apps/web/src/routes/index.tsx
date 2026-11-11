import { Button } from "@mostly/ui/components/button";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";

import { ModeToggle } from "@/components/mode-toggle";
import { authClient, signInWithGoogle } from "@/lib/auth-client";

const LandingPage = () => {
  const { error: callbackError } = Route.useSearch();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setOpening(true);
    setError(null);

    try {
      await signInWithGoogle();
    } catch (error_) {
      setOpening(false);
      setError(
        error_ instanceof Error
          ? error_.message
          : "Could not sign in with Google."
      );
    }
  };

  const message =
    error ?? (callbackError ? "Sign-in didn't complete. Try again." : null);

  return (
    <div className="grid min-h-svh justify-items-center pt-[max(var(--gutter),env(safe-area-inset-top))] pr-[max(var(--gutter),env(safe-area-inset-right))] pb-[max(var(--gutter),env(safe-area-inset-bottom))] pl-[max(var(--gutter),env(safe-area-inset-left))] [--gutter:clamp(0.75rem,3vw,2.5rem)]">
      <div className="shadow-foreground/5 grid w-full max-w-[90rem] grid-rows-[auto_1fr] rounded-[clamp(1.75rem,4vw,3.5rem)] border bg-linear-[155deg,var(--card)_20%,color-mix(in_srgb,var(--card),var(--accent)_65%)] p-[clamp(1rem,3.4vw,3rem)] shadow-[0_1rem_3rem]">
        <header className="[&_button:focus-visible]:outline-ring flex flex-wrap items-center justify-between gap-2 [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-4">
          <div className="flex items-center gap-2.5 text-xl font-bold tracking-tight">
            <img src="/icon.svg" alt="" width={36} height={36} />
            <span>mostly</span>
          </div>

          <ModeToggle />
        </header>

        <main className="grid grid-rows-[1fr_auto] justify-items-center text-center">
          <div className="self-center py-10 sm:py-14">
            <h1 className="text-[clamp(1.875rem,7.6vw,7rem)] leading-[0.99] font-black tracking-[-0.055em] wrap-anywhere uppercase">
              A quiet record{" "}
              <span className="text-primary block">of what you did.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-[32ch] text-base leading-relaxed text-[color:color-mix(in_srgb,var(--muted-foreground),var(--foreground)_18%)] sm:mt-7 sm:text-lg">
              Track your goals, log your sessions, and see your progress over
              time.
            </p>
          </div>

          <div className="grid justify-items-center gap-3">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 gap-2.5 rounded-full border-[#747775] bg-white px-3 text-sm text-[#1f1f1f] hover:bg-neutral-100 hover:text-[#1f1f1f] has-data-[icon=inline-start]:pl-3 dark:border-[#8e918f] dark:bg-[#131314] dark:text-[#e3e3e3] dark:hover:bg-neutral-800 dark:hover:text-[#e3e3e3]"
              disabled={opening}
              onClick={handleSignIn}
            >
              <img
                src="/google-g.png"
                alt=""
                width={18}
                height={18}
                data-icon="inline-start"
                className="size-4.5 shrink-0 object-contain"
              />
              {opening ? "Opening Google…" : "Get Started"}
            </Button>
            {message ? (
              <p role="alert" className="text-destructive text-sm">
                {message}
              </p>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
};

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { error?: string } => ({
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  beforeLoad: async () => {
    const session = await authClient.getSession().catch(() => null);
    if (session?.data) {
      throw redirect({ to: "/today", replace: true });
    }
  },
  component: LandingPage,
});
