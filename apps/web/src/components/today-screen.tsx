import type { GoalDto } from "@mostly/api/routers/goals";
import type { SettingValues } from "@mostly/domain";
import { isBeforeRollover } from "@mostly/domain";
import { Link } from "@tanstack/react-router";

import type { TodayView } from "@/lib/today";
import { dailyProgressPercent, todayProgressCopy } from "@/lib/today";

import { TodayGoalRow, WeeklyGoalRow } from "./today-goal-row";
import { TodayHeader } from "./today-header";
import { TodaySyncFooter } from "./today-sync-footer";

export interface PendingUndo {
  goalId: string;
  logicalDate: string;
  name: string;
}

export const TodayScreen = ({
  view,
  today,
  settings,
  now,
  undo,
  announcement,
  onMarkDone,
  onUndo,
}: {
  view: TodayView;
  today: string;
  settings: SettingValues;
  now: Date;
  undo: PendingUndo | null;
  announcement: string;
  onMarkDone: (goal: GoalDto) => void;
  onUndo: () => void;
}) => {
  const late = isBeforeRollover(now, {
    timeZone: settings.timeZone,
    rolloverHour: settings.dayRolloverHour,
  });
  const progressCopy = todayProgressCopy(view);
  const activeUndo = undo?.logicalDate === today ? undo : null;

  return (
    <div className="max-w-[720px]">
      <section className="py-4">
        <TodayHeader
          today={today}
          late={late}
          rolloverHour={settings.dayRolloverHour}
          progressCopy={progressCopy}
          progressPercent={dailyProgressPercent(
            view.dailyDone,
            view.dailyTotal
          )}
          showBar={view.dailyTotal > 0}
        />

        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>

        {view.activeGoalCount === 0 ? (
          <div className="bg-card mt-6 rounded-2xl border p-6">
            <p className="text-muted-foreground text-sm">
              Add the first thing you want to keep doing.
            </p>
            <Link
              to="/goals"
              className="bg-primary text-primary-foreground focus-visible:ring-ring/50 mt-4 inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
            >
              Add a goal
            </Link>
          </div>
        ) : (
          <>
            <section aria-labelledby="today-heading" className="mt-6">
              <h2
                id="today-heading"
                className="text-muted-foreground text-sm font-medium tracking-wide uppercase"
              >
                Today
              </h2>
              {view.todayGoals.length > 0 ? (
                <ul className="mt-2 space-y-2">
                  {view.todayGoals.map((entry) => (
                    <TodayGoalRow
                      key={entry.goal.id}
                      entry={entry}
                      detailsOpen={false}
                      undoActive={activeUndo?.goalId === entry.goal.id}
                      onMarkDone={onMarkDone}
                      onUndo={onUndo}
                    />
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground mt-2 text-sm">
                  Nothing scheduled today.
                </p>
              )}
            </section>

            {view.weeklyGoals.length > 0 ? (
              <section aria-labelledby="week-heading" className="mt-8">
                <h2
                  id="week-heading"
                  className="text-muted-foreground text-sm font-medium tracking-wide uppercase"
                >
                  This week
                </h2>
                <ul className="mt-2 space-y-2">
                  {view.weeklyGoals.map((entry) => (
                    <WeeklyGoalRow
                      key={entry.goal.id}
                      entry={entry}
                      detailsOpen={false}
                      undoActive={activeUndo?.goalId === entry.goal.id}
                      onMarkDone={onMarkDone}
                      onUndo={onUndo}
                    />
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </section>

      <TodaySyncFooter />
    </div>
  );
};
