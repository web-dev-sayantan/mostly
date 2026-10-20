import { createFileRoute } from "@tanstack/react-router";

import { Placeholder } from "@/components/placeholder";

export const Route = createFileRoute("/_auth/today")({
  component: TodayPage,
});

function TodayPage() {
  return (
    <div className="max-w-[720px]">
      <Placeholder title="Today" detail="Today's goals will appear here." />
    </div>
  );
}
