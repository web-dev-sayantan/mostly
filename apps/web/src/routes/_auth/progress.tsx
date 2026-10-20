import { createFileRoute } from "@tanstack/react-router";

import { Placeholder } from "@/components/placeholder";

export const Route = createFileRoute("/_auth/progress")({
  component: ProgressPage,
});

function ProgressPage() {
  return <Placeholder title="Progress" detail="Your record will build here." />;
}
