import { createFileRoute } from "@tanstack/react-router";

import { Placeholder } from "@/components/placeholder";

export const Route = createFileRoute("/_auth/goals_/$id")({
  component: GoalDetailPage,
});

function GoalDetailPage() {
  return <Placeholder title="Goal" detail="This goal's history and details will live here." />;
}
