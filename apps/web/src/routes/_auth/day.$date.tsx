import { createFileRoute } from "@tanstack/react-router";

import { Placeholder } from "@/components/placeholder";

export const Route = createFileRoute("/_auth/day/$date")({
  component: DayPage,
});

function DayPage() {
  const { date } = Route.useParams();

  return <Placeholder title={date} detail="This day's record will live here." />;
}
