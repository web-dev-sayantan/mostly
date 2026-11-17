import type { ProgressRange } from "@mostly/domain";
import { Button } from "@mostly/ui/components/button";
import { Skeleton } from "@mostly/ui/components/skeleton";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { ProgressScreen } from "@/components/progress-screen";
import { orpc } from "@/utils/orpc";

const ProgressSkeleton = () => (
  <div className="max-w-[960px]" aria-busy="true">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-[28px] leading-tight font-medium">Progress</h1>
      <Skeleton className="h-[54px] w-44 rounded-full" />
    </div>
    <p className="sr-only">Loading progress…</p>

    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Skeleton className="h-[88px] rounded-2xl" />
      <Skeleton className="h-[88px] rounded-2xl" />
      <Skeleton className="col-span-2 h-[88px] rounded-2xl sm:col-span-1" />
    </div>

    <div className="mt-8">
      <Skeleton className="h-5 w-32 rounded-md" />
      <Skeleton className="mt-2 h-44 rounded-2xl" />
    </div>

    <div className="mt-8">
      <Skeleton className="h-5 w-20 rounded-md" />
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
    </div>
  </div>
);

const ProgressPage = () => {
  const [range, setRange] = useState<ProgressRange>(30);
  const progressQuery = useQuery({
    ...orpc.progress.get.queryOptions({ input: { range } }),
    placeholderData: keepPreviousData,
    meta: { suppressErrorToast: true },
  });

  if (progressQuery.isPending) {
    return <ProgressSkeleton />;
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
