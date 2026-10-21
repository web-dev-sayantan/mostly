import { Button } from "@mostly/ui/components/button";
import { Input } from "@mostly/ui/components/input";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import {
  CadenceFields,
  cadenceFromValue,
  cadenceFormValue,
} from "@/components/cadence-fields";
import type { CadenceFormValue } from "@/components/cadence-fields";
import { authClient, signInWithGoogle } from "@/lib/auth-client";
import { cadenceSummary, defaultStartDate } from "@/lib/goals";
import {
  REMINDER_PERMISSION_COPY,
  STARTER_GOALS,
  TODAY_HINT_KEY,
} from "@/lib/onboarding";
import { enablePushReminders, isInstalledApp, pushPlatform } from "@/lib/push";
import { detectedTimeZone } from "@/lib/time";
import { client, orpc } from "@/utils/orpc";

interface DraftGoal {
  id: string;
  name: string;
  emoji: string;
  cadence: CadenceFormValue;
}

const draftFrom = (name: string, emoji: string): DraftGoal => ({
  id: crypto.randomUUID(),
  name,
  emoji,
  cadence: cadenceFormValue({ type: "daily" }),
});

const SignInStep = () => {
  const [status, setStatus] = useState<"idle" | "opening">("idle");
  const [signInError, setSignInError] = useState<string | null>(null);

  const signIn = async () => {
    setStatus("opening");
    setSignInError(null);
    try {
      await signInWithGoogle();
    } catch (error) {
      setStatus("idle");
      setSignInError(
        error instanceof Error
          ? error.message
          : "Could not sign in with Google."
      );
    }
  };

  return (
    <section aria-labelledby="onboarding-sign-in">
      <p className="text-muted-foreground text-sm">Step 1 of 3</p>
      <h1
        id="onboarding-sign-in"
        tabIndex={-1}
        className="mt-3 text-[28px] leading-tight font-medium outline-none"
      >
        Sign in to Mostly
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Your goals stay yours. No social feed, no sharing.
      </p>
      <Button
        type="button"
        className="mt-6 min-h-11 w-full rounded-full text-sm sm:w-auto sm:px-6"
        disabled={status === "opening"}
        onClick={signIn}
      >
        {status === "opening" ? "Opening Google…" : "Continue with Google"}
      </Button>
      {signInError ? (
        <p role="alert" className="text-destructive mt-4 text-sm">
          {signInError}
        </p>
      ) : null}
      <p className="text-muted-foreground mt-8 text-sm">
        A quiet record of what you did.
      </p>
    </section>
  );
};

const OnboardingPage = () => {
  const session = authClient.useSession();
  const navigate = useNavigate();
  const [step, setStep] = useState(2);
  const [drafts, setDrafts] = useState<DraftGoal[]>([]);
  const [custom, setCustom] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reminderTime, setReminderTime] = useState("21:30");
  const [saving, setSaving] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const created = useRef(new Set<string>());
  const platform = pushPlatform();
  const installed = isInstalledApp();
  const publicKeyQuery = useQuery({
    ...orpc.reminders.publicKey.queryOptions(),
    enabled: Boolean(session.data),
  });

  useEffect(() => {
    if (step > 1) {
      headingRef.current?.focus();
    }
  }, [step]);

  const toggleStarter = (name: string, emoji: string) => {
    setDrafts((current) =>
      current.some((draft) => draft.name === name)
        ? current.filter((draft) => draft.name !== name)
        : [...current, draftFrom(name, emoji)]
    );
    setCustomError(null);
  };

  const addCustom = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = custom.trim();
    if (name.length === 0) {
      setCustomError("Enter a goal name.");
      return;
    }
    if (name.length > 40) {
      setCustomError("Keep it to 40 characters.");
      return;
    }
    if (
      drafts.some((draft) => draft.name.toLowerCase() === name.toLowerCase())
    ) {
      setCustomError("That goal is already selected.");
      return;
    }
    setDrafts((current) => [...current, draftFrom(name, "🌱")]);
    setCustom("");
    setCustomError(null);
  };

  const updateCadence = (id: string, cadence: CadenceFormValue) => {
    setDrafts((current) =>
      current.map((draft) => (draft.id === id ? { ...draft, cadence } : draft))
    );
  };

  const finish = async (withReminder: boolean) => {
    setSaving(true);
    setFinishError(null);

    try {
      if (
        withReminder &&
        platform !== "ios" &&
        publicKeyQuery.data?.publicKey
      ) {
        await enablePushReminders(publicKeyQuery.data.publicKey);
      }

      const startDate = defaultStartDate();
      const pending = drafts.filter(
        (draft) => !created.current.has(draft.name)
      );
      await Promise.all(
        pending.map(async (draft) => {
          await client.goals.create({
            name: draft.name,
            emoji: draft.emoji,
            color: null,
            priority: "medium",
            cadence: cadenceFromValue(draft.cadence),
            startDate,
          });
          created.current.add(draft.name);
        })
      );

      await client.settings.get({ timeZone: detectedTimeZone() });
      await client.reminders.update({
        enabled: withReminder,
        time: reminderTime || "21:30",
      });
      await client.onboarding.complete();
      try {
        localStorage.setItem(TODAY_HINT_KEY, "1");
      } catch {
        // The hint is a courtesy; onboarding still completed.
      }
      await navigate({ to: "/today" });
    } catch (error) {
      setFinishError(
        error instanceof Error
          ? error.message
          : "Could not finish setting up. Try again."
      );
    }

    setSaving(false);
  };

  if (session.isPending) {
    return (
      <main className="grid min-h-svh place-items-center px-6">
        <p className="text-muted-foreground text-sm">Loading Mostly…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto grid min-h-svh w-full max-w-2xl content-start gap-6 px-6 py-10">
      <header className="flex items-center gap-2">
        <img src="/icon.svg" alt="" className="size-8 rounded-lg" />
        <span className="font-medium">mostly</span>
      </header>

      {session.data ? null : <SignInStep />}

      {session.data && step === 2 ? (
        <section aria-labelledby="onboarding-goals">
          <p className="text-muted-foreground text-sm">Step 2 of 3</p>
          <h1
            id="onboarding-goals"
            ref={headingRef}
            tabIndex={-1}
            className="mt-3 text-[28px] leading-tight font-medium outline-none"
          >
            Pick a few things to keep doing.
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Three to five is a good start. You can add more later.
          </p>

          <fieldset className="mt-6">
            <legend className="sr-only">Starter goals</legend>
            <div className="flex flex-wrap gap-2">
              {STARTER_GOALS.map((starter) => {
                const selected = drafts.some(
                  (draft) => draft.name === starter.name
                );
                return (
                  <button
                    key={starter.name}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleStarter(starter.name, starter.emoji)}
                    className="border-border hover:bg-muted aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:border-primary inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm"
                  >
                    <span aria-hidden="true">{starter.emoji}</span>
                    {starter.name}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <form onSubmit={addCustom} className="mt-5 grid gap-2">
            <label htmlFor="custom-goal" className="text-sm font-medium">
              Something else
            </label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="custom-goal"
                value={custom}
                onChange={(event) => setCustom(event.target.value)}
                maxLength={40}
                autoComplete="off"
                placeholder="Add your own"
                className="h-11 max-w-72 text-base"
                aria-invalid={customError !== null}
                aria-describedby={customError ? "custom-goal-error" : undefined}
              />
              <Button
                type="submit"
                variant="outline"
                className="min-h-11 rounded-full px-4 text-sm"
              >
                Add
              </Button>
            </div>
            {customError ? (
              <p
                id="custom-goal-error"
                role="alert"
                className="text-destructive text-sm"
              >
                {customError}
              </p>
            ) : null}
          </form>

          {drafts.length > 0 ? (
            <ul className="mt-6 grid gap-3">
              {drafts.map((draft) => {
                const open = expanded === draft.id;
                const cadence = cadenceFromValue(draft.cadence);
                return (
                  <li key={draft.id} className="bg-card rounded-2xl border p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span aria-hidden="true" className="text-xl">
                        {draft.emoji}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-medium">
                          {draft.name}
                        </span>
                        <span className="text-muted-foreground block text-sm">
                          {cadenceSummary(cadence)} · Medium
                        </span>
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        aria-expanded={open}
                        aria-controls={`cadence-${draft.id}`}
                        onClick={() => setExpanded(open ? null : draft.id)}
                        className="min-h-11 rounded-full px-3 text-sm"
                      >
                        Change cadence
                      </Button>
                    </div>
                    {open ? (
                      <div id={`cadence-${draft.id}`} className="mt-4">
                        <CadenceFields
                          fieldId={`cadence-${draft.id}`}
                          value={draft.cadence}
                          onChange={(value) => updateCadence(draft.id, value)}
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-2">
            <Button
              type="button"
              className="min-h-11 rounded-full px-5 text-sm"
              onClick={() => setStep(3)}
            >
              Continue
            </Button>
            <span className="text-muted-foreground self-center text-sm">
              You can skip this and add goals later.
            </span>
          </div>
        </section>
      ) : null}

      {session.data && step === 3 ? (
        <section aria-labelledby="onboarding-reminder">
          <p className="text-muted-foreground text-sm">Step 3 of 3</p>
          <h1
            id="onboarding-reminder"
            ref={headingRef}
            tabIndex={-1}
            className="mt-3 text-[28px] leading-tight font-medium outline-none"
          >
            Choose a reminder time.
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {REMINDER_PERMISSION_COPY}
          </p>

          <div className="mt-6 grid gap-2">
            <label
              htmlFor="onboarding-reminder-time"
              className="text-sm font-medium"
            >
              Reminder time
            </label>
            <input
              id="onboarding-reminder-time"
              type="time"
              value={reminderTime}
              onChange={(event) => setReminderTime(event.target.value)}
              className="border-input bg-background min-h-11 w-full max-w-48 rounded-lg border px-3 text-base"
            />
            <p className="text-muted-foreground text-sm">
              Local time. One reminder a day at most.
            </p>
          </div>

          {platform === "ios" ? (
            <p className="text-muted-foreground mt-4 text-sm">
              {installed
                ? "After your first session, we'll ask once whether to send it."
                : "After you install Mostly, we'll ask once you've logged your first session."}
            </p>
          ) : null}

          {finishError ? (
            <p role="alert" className="text-destructive mt-4 text-sm">
              {finishError}
            </p>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-2">
            <Button
              type="button"
              className="min-h-11 rounded-full px-5 text-sm"
              disabled={saving}
              onClick={() => finish(true)}
            >
              {saving ? "Setting up…" : "Continue"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 rounded-full px-4 text-sm"
              disabled={saving}
              onClick={() => finish(false)}
            >
              Not now
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 rounded-full px-4 text-sm"
              disabled={saving}
              onClick={() => setStep(2)}
            >
              Back
            </Button>
          </div>
        </section>
      ) : null}
    </main>
  );
};

export const Route = createFileRoute("/onboarding")({
  beforeLoad: async () => {
    const session = await authClient.getSession().catch(() => null);
    if (!session?.data) {
      return;
    }
    const status = await client.onboarding.status().catch(() => null);
    if (status?.completed) {
      throw redirect({ to: "/today" });
    }
  },
  component: OnboardingPage,
});
