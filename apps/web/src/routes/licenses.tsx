import { createFileRoute } from "@tanstack/react-router";

import { SOURCE_URL } from "@/lib/app-info";

const LicensesPage = () => (
  <main className="mx-auto grid w-full max-w-[720px] gap-4 px-4 py-10 text-base">
    <div>
      <a
        href="/account"
        className="focus-visible:ring-ring/50 inline-flex min-h-11 w-fit items-center text-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
      >
        Back to Account
      </a>
      <h1 className="mt-4 text-[28px] leading-tight font-medium">
        Open-source licenses
      </h1>
    </div>

    <p className="text-sm">
      Mostly is built with open-source software, including React, TanStack
      Router and Query, Drizzle ORM, Better Auth, Hono, Tailwind CSS, and Base
      UI. Their licenses are included with the source distribution.
    </p>

    <p className="text-sm">
      Source code and dependency licenses are available in the project
      repository.
    </p>

    <a
      href={SOURCE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="focus-visible:ring-ring/50 inline-flex min-h-11 w-fit items-center text-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
    >
      {SOURCE_URL}
    </a>
  </main>
);

export const Route = createFileRoute("/licenses")({
  component: LicensesPage,
});
