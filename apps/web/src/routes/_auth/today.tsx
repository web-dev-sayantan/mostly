import { isBeforeRollover } from "@mostly/domain";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
  detectedTimeZone,
  formatLogicalDate,
  formatRolloverHour,
} from "@/lib/time";
import { orpc } from "@/utils/orpc";

const TodayPage = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const settingsQuery = useQuery(
    orpc.settings.get.queryOptions({ input: { timeZone: detectedTimeZone() } })
  );
  const current = settingsQuery.data?.current;
  const today = settingsQuery.data?.today;
  const late = current
    ? isBeforeRollover(now, {
        timeZone: current.timeZone,
        rolloverHour: current.dayRolloverHour,
      })
    : false;

  return (
    <div className="max-w-[720px]">
      <section className="py-4">
        <h1 className="text-[28px] leading-tight font-medium">
          {today ? formatLogicalDate(today) : "Today"}
          {late && current ? (
            <span className="text-muted-foreground ml-1 text-base font-normal">
              · still open until {formatRolloverHour(current.dayRolloverHour)}
            </span>
          ) : null}
        </h1>
        <div className="bg-card text-muted-foreground mt-6 rounded-lg border p-6 text-sm">
          Your goals will appear here.
        </div>
      </section>
    </div>
  );
};

export const Route = createFileRoute("/_auth/today")({
  component: TodayPage,
});
