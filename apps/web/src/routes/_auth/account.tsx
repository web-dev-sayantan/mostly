import { Button } from "@mostly/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { DataControls } from "@/components/account-data";
import { ReminderSettings } from "@/components/account-reminder";
import { AccountSection } from "@/components/account-section";
import { useTheme } from "@/components/theme-provider";
import { APP_VERSION, SOURCE_URL } from "@/lib/app-info";
import { authClient } from "@/lib/auth-client";
import { IosInstallInstructions } from "@/lib/install/install-prompt";
import {
  detectedTimeZone,
  formatLogicalDate,
  formatRolloverHour,
} from "@/lib/time";
import { orpc } from "@/utils/orpc";

const rolloverHours = [0, 1, 2, 3, 4, 5, 6] as const;
const weekStarts = [
  { value: 1, label: "Monday" },
  { value: 7, label: "Sunday" },
] as const;
const themes = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

const Profile = () => {
  const { data: session, isPending } = authClient.useSession();

  if (isPending || !session) {
    return (
      <AccountSection id="profile" title="Profile">
        <p className="text-muted-foreground text-sm">Loading profile.</p>
      </AccountSection>
    );
  }

  const { user } = session;
  const name = user.name || user.email;

  return (
    <AccountSection id="profile" title="Profile">
      <div className="flex items-center gap-3">
        {user.image ? (
          <img
            src={user.image}
            alt=""
            referrerPolicy="no-referrer"
            className="border-border size-12 rounded-full border"
          />
        ) : (
          <span
            aria-hidden="true"
            className="bg-accent text-accent-foreground grid size-12 place-items-center rounded-full text-lg"
          >
            {name.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-base font-medium">{name}</p>
          <p className="text-muted-foreground truncate text-sm">{user.email}</p>
        </div>
      </div>
    </AccountSection>
  );
};

const Install = () => (
  <AccountSection id="install" title="Install">
    <p className="text-sm">Add Mostly to your home screen.</p>
    <ul className="grid gap-3 text-sm">
      <li>
        <span className="font-medium">Android</span>
        <span className="text-muted-foreground block">
          Open Mostly in Chrome, open the menu, then choose Add to Home screen.
        </span>
      </li>
      <li>
        <span className="font-medium">iPhone and iPad</span>
        <IosInstallInstructions className="text-muted-foreground mt-1" />
      </li>
      <li>
        <span className="font-medium">Desktop</span>
        <span className="text-muted-foreground block">
          Use the install icon in your browser&apos;s address bar, or choose
          Install app from the menu.
        </span>
      </li>
    </ul>
  </AccountSection>
);

const Privacy = () => (
  <AccountSection id="privacy" title="Privacy">
    <p className="text-sm">
      Your goals stay yours. No feed, no sharing, and no analytics or trackers.
      Notes and moods are never logged.
    </p>
    <a
      href="/privacy"
      className="focus-visible:ring-ring/50 inline-flex min-h-11 w-fit items-center text-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
    >
      Read the full privacy policy
    </a>
  </AccountSection>
);

const About = () => (
  <AccountSection id="about" title="About">
    <p className="text-sm">Mostly {APP_VERSION}</p>
    <p className="text-muted-foreground text-sm">
      A quiet record of what you did.
    </p>
    <div className="flex flex-wrap gap-4 text-sm">
      <a
        href="/licenses"
        className="focus-visible:ring-ring/50 inline-flex min-h-11 items-center underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
      >
        Open-source licenses
      </a>
      <a
        href={SOURCE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="focus-visible:ring-ring/50 inline-flex min-h-11 items-center underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
      >
        Source code
      </a>
    </div>
  </AccountSection>
);

const AccountPage = () => (
  <section className="max-w-[720px] py-4">
    <h1 className="text-[28px] leading-tight font-medium">Account</h1>
    <div className="mt-6 grid gap-6">
      <Profile />
      <ReminderSettings />
      <Preferences />
      <DataControls />
      <Install />
      <Privacy />
      <About />
    </div>
  </section>
);

const Preferences = () => {
  const timeZone = detectedTimeZone();
  const queryClient = useQueryClient();
  const settingsQuery = useQuery(
    orpc.settings.get.queryOptions({ input: { timeZone } })
  );
  const update = useMutation(
    orpc.settings.update.mutationOptions({
      onSuccess: async (data) => {
        await queryClient.invalidateQueries({
          queryKey: orpc.settings.get.queryKey({ input: { timeZone } }),
        });
        const effectiveFrom = data.change?.versions.at(-1)?.effectiveFrom;
        toast.success(
          effectiveFrom
            ? `Saved. Applies from ${formatLogicalDate(effectiveFrom)}.`
            : "Saved."
        );
      },
      onError: (error) => {
        toast.error(error.message || "Could not save settings.");
      },
    })
  );

  // Show the newest saved value so a prospective change does not snap back visually.
  const settings =
    settingsQuery.data?.history.at(-1) ?? settingsQuery.data?.current;

  return (
    <AccountSection id="preferences" title="Preferences">
      {settingsQuery.isPending ? (
        <p className="text-muted-foreground text-sm">Loading settings.</p>
      ) : null}
      {settingsQuery.isError ? (
        <div className="grid gap-3">
          <p className="text-sm">Could not load settings.</p>
          <Button
            variant="outline"
            className="min-h-11 w-fit px-4 text-sm"
            onClick={() => settingsQuery.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : null}
      {settings ? (
        <>
          <ThemePreference />
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Week starts</legend>
            <div className="flex flex-wrap gap-2">
              {weekStarts.map((option) => (
                <label
                  key={option.value}
                  className="border-border hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-accent has-[:focus-visible]:ring-ring/50 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm has-[:focus-visible]:ring-2"
                >
                  <input
                    type="radio"
                    name="week-starts-on"
                    value={option.value}
                    checked={settings.weekStartsOn === option.value}
                    disabled={update.isPending}
                    onChange={() =>
                      update.mutate({ weekStartsOn: option.value })
                    }
                    className="size-4"
                  />
                  {option.label}
                </label>
              ))}
            </div>
            <p className="text-muted-foreground text-sm">
              Applies from the next week. Past weeks keep their start day.
            </p>
          </fieldset>

          <div className="grid gap-2">
            <label htmlFor="day-rollover" className="text-sm font-medium">
              Day rollover
            </label>
            <select
              id="day-rollover"
              value={settings.dayRolloverHour}
              disabled={update.isPending}
              onChange={(event) =>
                update.mutate({ dayRolloverHour: Number(event.target.value) })
              }
              className="border-input bg-background min-h-11 w-full max-w-64 rounded-lg border px-3 text-sm"
            >
              {rolloverHours.map((hour) => (
                <option key={hour} value={hour}>
                  {formatRolloverHour(hour)}
                </option>
              ))}
            </select>
            <p className="text-muted-foreground text-sm">
              Today closes under the current rollover. A new time applies from
              the next day.
            </p>
          </div>

          <TimeZonePreference
            detected={timeZone}
            currentTimeZone={settings.timeZone}
            isSaving={update.isPending}
            onSave={() => update.mutate({ timeZone, confirmTimeZone: true })}
          />
        </>
      ) : null}
    </AccountSection>
  );
};

const ThemePreference = () => {
  const { theme, setTheme } = useTheme();
  const selected = theme ?? "system";

  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-medium">Theme</legend>
      <div className="flex flex-wrap gap-2">
        {themes.map((option) => (
          <label
            key={option.value}
            className="border-border hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-accent has-[:focus-visible]:ring-ring/50 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm has-[:focus-visible]:ring-2"
          >
            <input
              type="radio"
              name="theme"
              value={option.value}
              checked={selected === option.value}
              onChange={() => setTheme(option.value)}
              className="size-4"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
};

const TimeZonePreference = ({
  detected,
  currentTimeZone,
  isSaving,
  onSave,
}: {
  detected: string;
  currentTimeZone: string;
  isSaving: boolean;
  onSave: () => void;
}) => {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium">Timezone</span>
      <p className="text-sm">{currentTimeZone}</p>
      <p className="text-muted-foreground text-sm">
        A change applies from the next day. Past days keep their timezone.
        Detected: {detected}.
      </p>
      {confirming ? (
        <div className="bg-muted/50 grid gap-3 rounded-lg border p-3">
          <p className="text-sm">
            Use {detected}? This applies from the next day. Past days keep their
            timezone.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              className="min-h-11 px-4 text-sm"
              disabled={isSaving}
              onClick={onSave}
            >
              Use {detected}
            </Button>
            <Button
              variant="ghost"
              className="min-h-11 px-4 text-sm"
              disabled={isSaving}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
      {!confirming && detected !== currentTimeZone ? (
        <Button
          variant="outline"
          className="min-h-11 w-fit px-4 text-sm"
          disabled={isSaving}
          onClick={() => setConfirming(true)}
        >
          Use current timezone
        </Button>
      ) : null}
    </div>
  );
};

export const Route = createFileRoute("/_auth/account")({
  component: AccountPage,
});
