import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import AppShell from "@/components/app-shell";
import { authClient } from "@/lib/auth-client";
import { bindOfflineUser } from "@/lib/offline";
import { OFFLINE_STORAGE_KEYS } from "@/lib/offline/store";

const hasKnownSession = (): boolean => {
  try {
    return localStorage.getItem(OFFLINE_STORAGE_KEYS.auth) === "1";
  } catch {
    return false;
  }
};

const rememberSession = (): void => {
  try {
    localStorage.setItem(OFFLINE_STORAGE_KEYS.auth, "1");
  } catch {
    // Storage can be unavailable in private modes; online opens still work.
  }
};

const AuthLayout = () => (
  <AppShell>
    <Outlet />
  </AppShell>
);

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
  beforeLoad: async () => {
    const knownSession = hasKnownSession();
    const online = typeof navigator === "undefined" ? true : navigator.onLine;
    let networkFailed = false;
    const session = await authClient.getSession().catch(() => {
      networkFailed = true;
      return null;
    });

    if (session?.data) {
      // Local cache belongs to one account. A deleted account returning as a new
      // user id drops its old queue here, before the next replay. Remember the
      // shell after the wipe so switching accounts keeps offline opens alive.
      bindOfflineUser(session.data.user.id);
      rememberSession();
      return { session };
    }

    // The cached shell and local sessions stay available with no network.
    if (knownSession && (!online || networkFailed)) {
      return;
    }

    // First run starts at onboarding; a completed account redirects to Today.
    throw redirect({ to: "/onboarding" });
  },
});
