import type { ProgressRange } from "@mostly/domain";
import { Button } from "@mostly/ui/components/button";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { ProgressScreen } from "@/components/progress-screen";
import { orpc } from "@/utils/orpc";

const ProgressPage = () => {
  const [range, setRange] = useState<ProgressRange>(30);
  const progressQuery = useQuery({
    ...orpc.progress.get.queryOptions({ input: { range } }),
    placeholderData: keepPreviousData,
    meta: { suppressErrorToast: true },
  });

  if (progressQuery.isPending) {
    return (
      <div className="max-w-[960px]">
        <h1 className="text-[28px] leading-tight font-medium">Progress</h1>
        <p className="text-muted-foreground mt-6 text-sm">Loading progress…</p>
      </div>
    );
  }

  if (progressQuery.isError || !progressQuery.data) {
    return (
      <div className="max-w-[960px]">
        <h1 className="text-[28px] leading-tight font-medium">Progress</h1>
        <div className="mt-6 space-y-3">
          <p role="alert" className="text-sm">
            Could not load Progress.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => progressQuery.refetch()}
            className="min-h-11 rounded-full px-4 text-sm"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ProgressScreen
      result={progressQuery.data}
      range={range}
      onRangeChange={setRange}
    />
  );
};

export const Route = createFileRoute("/_auth/progress")({
  component: ProgressPage,
});
