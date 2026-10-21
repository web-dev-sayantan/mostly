import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import AppShell from "@/components/app-shell";
import { authClient } from "@/lib/auth-client";
import { bindOfflineUser } from "@/lib/offline";

const AuthLayout = () => (
  <AppShell>
    <Outlet />
  </AppShell>
);

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({ to: "/login" });
    }
    // Local cache belongs to one account. A deleted account returning as a new
    // user id drops its old queue here, before the next replay.
    bindOfflineUser(session.data.user.id);
    return { session };
  },
});
