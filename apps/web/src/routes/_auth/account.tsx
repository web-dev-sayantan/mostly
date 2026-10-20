import { createFileRoute } from "@tanstack/react-router";

import { Placeholder } from "@/components/placeholder";

export const Route = createFileRoute("/_auth/account")({
  component: AccountPage,
});

function AccountPage() {
  return (
    <Placeholder title="Account" detail="Settings, export, and account options will live here." />
  );
}
