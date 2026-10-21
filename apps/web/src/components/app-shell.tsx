import { Link } from "@tanstack/react-router";
import { CalendarDays, ChartNoAxesColumn, Target, User } from "lucide-react";
import type { ReactNode } from "react";

import { InstallPrompt } from "@/lib/install/install-prompt";
import { OfflineBanner, SyncStatusLine } from "@/lib/offline";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

const links = [
  { to: "/today", label: "Today", icon: CalendarDays },
  { to: "/progress", label: "Progress", icon: ChartNoAxesColumn },
  { to: "/goals", label: "Goals", icon: Target },
  { to: "/account", label: "Account", icon: User },
] as const;

const AppShell = ({ children }: { children: ReactNode }) => (
  <div className="flex min-h-svh flex-col">
    <header className="bg-background/95 sticky top-0 z-20 border-b pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[960px] items-center gap-2 px-4">
        <Link
          to="/today"
          className="flex min-h-11 items-center gap-2 rounded-lg pr-1 font-medium"
          aria-label="Mostly, Today"
        >
          <img src="/icon.svg" alt="" className="size-8 rounded-lg" />
          <span className="text-base">mostly</span>
        </Link>
        <nav aria-label="Primary" className="ml-2 hidden md:block">
          <ul className="flex items-center gap-1">
            {links.map(({ to, label }) => (
              <li key={to}>
                <Link
                  to={to}
                  className="text-muted-foreground hover:bg-muted hover:text-foreground data-[status=active]:bg-accent data-[status=active]:text-accent-foreground inline-flex min-h-11 items-center rounded-full px-3 text-sm"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <ModeToggle />
          <UserMenu />
        </div>
      </div>
    </header>

    <OfflineBanner />
    <InstallPrompt />

    <main className="mx-auto w-full max-w-[960px] flex-1 pt-4 pr-[max(1rem,env(safe-area-inset-right))] pb-[calc(5.5rem+env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] md:pb-8">
      {children}
      <footer className="border-border text-muted-foreground mt-8 border-t pt-3 text-sm">
        <SyncStatusLine />
      </footer>
    </main>

    <nav
      aria-label="Primary"
      className="bg-background/95 fixed inset-x-0 bottom-0 z-20 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid w-full max-w-[960px] grid-cols-4 pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
        {links.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              className="text-muted-foreground data-[status=active]:text-foreground flex min-h-11 flex-col items-center justify-center gap-0.5 py-1.5 text-sm"
            >
              <Icon className="size-5" aria-hidden="true" />
              <span>{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  </div>
);

export default AppShell;
