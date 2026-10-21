import { createFileRoute } from "@tanstack/react-router";

const PrivacyPage = () => (
  <main className="mx-auto grid w-full max-w-[720px] gap-6 px-4 py-10 text-base">
    <div>
      <a
        href="/account"
        className="focus-visible:ring-ring/50 inline-flex min-h-11 w-fit items-center text-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
      >
        Back to Account
      </a>
      <h1 className="mt-4 text-[28px] leading-tight font-medium">Privacy</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        A quiet record of what you did, and nothing else.
      </p>
    </div>

    <section className="grid gap-2">
      <h2 className="text-base font-medium">What we store</h2>
      <p className="text-sm">
        Your Google name, email, and profile photo; your goals and schedules;
        your time settings; and your sessions, including any minutes, note, and
        mood you add. This data exists to sync your record across your devices.
      </p>
    </section>

    <section className="grid gap-2">
      <h2 className="text-base font-medium">What we don&apos;t do</h2>
      <p className="text-sm">
        There is no feed, no sharing, no analytics, and no third-party tracking.
        Notes, moods, and goal names are never written to logs.
      </p>
    </section>

    <section className="grid gap-2">
      <h2 className="text-base font-medium">Sign-in</h2>
      <p className="text-sm">
        Sign-in uses Google with the openid, email, and profile scopes. Mostly
        does not request Calendar, Drive, or contacts.
      </p>
    </section>

    <section className="grid gap-2">
      <h2 className="text-base font-medium">Your controls</h2>
      <p className="text-sm">
        You can download a copy of everything or delete your account from the
        Account page. Deleting removes your live data immediately. Encrypted
        backups expire within 30 days.
      </p>
    </section>

    <p className="text-muted-foreground text-sm">
      This page is the full privacy policy for Mostly v1.
    </p>
  </main>
);

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});
