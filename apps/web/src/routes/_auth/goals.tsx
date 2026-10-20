import { createFileRoute } from "@tanstack/react-router";

import { Placeholder } from "@/components/placeholder";

export const Route = createFileRoute("/_auth/goals")({
  component: GoalsPage,
});

function GoalsPage() {
  return <Placeholder title="Goals" detail="Your goals will live here." />;
}
