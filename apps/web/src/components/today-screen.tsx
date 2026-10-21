import type { GoalDto } from "@mostly/api/routers/goals";
import type { SettingValues } from "@mostly/domain";
import { isBeforeRollover } from "@mostly/domain";
import { Link } from "@tanstack/react-router";

import type { LocalSession } from "@/lib/offline";
import { isSessionReadOnly } from "@/lib/session-details";
import type { TodayView } from "@/lib/today";
import { dailyProgressPercent, todayProgressCopy } from "@/lib/today";

import { NotScheduledToday } from "./not-scheduled-today";
import { PastSevenDays } from "./past-seven-days";
import { SessionDetails } from "./session-details";
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
  hasAnyGoal,
  undo,
  announcement,
  openGoalId,
  onMarkDone,
  onUndo,
  onOpenDetails,
  onCloseDetails,
  onRemoved,
  registerTrigger,
}: {
  view: TodayView;
  today: string;
  settings: SettingValues;
  now: Date;
  hasAnyGoal: boolean;
  undo: PendingUndo | null;
  announcement: string;
  openGoalId: string | null;
  onMarkDone: (goal: GoalDto) => void;
  onUndo: () => void;
  onOpenDetails: (goalId: string) => void;
  onCloseDetails: () => void;
  onRemoved: (goalName: string) => void;
  registerTrigger: (goalId: string, node: HTMLButtonElement | null) => void;
}) => {
  const late = isBeforeRollover(now, {
    timeZone: settings.timeZone,
    rolloverHour: settings.dayRolloverHour,
  });
  const progressCopy = todayProgressCopy(view);
  const activeUndo = undo?.logicalDate === today ? undo : null;
  const emptyCopy = hasAnyGoal
    ? "Nothing expected today."
    : "Add the first thing you want to keep doing.";
  const detailsFor = (goal: GoalDto, session: LocalSession | null) => {
    if (!session || openGoalId !== goal.id) {
      return;
    }
    return (
      <SessionDetails
        key={`${goal.id}-${session.id}`}
        panelId={`today-panel-${goal.id}`}
        goalName={goal.name}
        session={session}
        logicalDate={session.logicalDate}
        today={today}
        readOnly={isSessionReadOnly(goal, session.logicalDate, today)}
        onClose={onCloseDetails}
        onRemoved={onRemoved}
      />
    );
  };

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
            <p className="text-muted-foreground text-sm">{emptyCopy}</p>
            {hasAnyGoal ? null : (
              <Link
                to="/goals"
                className="bg-primary text-primary-foreground focus-visible:ring-ring/50 mt-4 inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
              >
                Add a goal
              </Link>
            )}
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
                      detailsOpen={openGoalId === entry.goal.id}
                      details={detailsFor(entry.goal, entry.session)}
                      undoActive={activeUndo?.goalId === entry.goal.id}
                      onMarkDone={onMarkDone}
                      onOpenDetails={onOpenDetails}
                      onUndo={onUndo}
                      registerTrigger={registerTrigger}
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
                      detailsOpen={openGoalId === entry.goal.id}
                      details={detailsFor(entry.goal, entry.session)}
                      undoActive={activeUndo?.goalId === entry.goal.id}
                      onMarkDone={onMarkDone}
                      onOpenDetails={onOpenDetails}
                      onUndo={onUndo}
                      registerTrigger={registerTrigger}
                    />
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </section>

      <div className="mt-8 grid gap-2">
        <PastSevenDays today={today} />
        <NotScheduledToday date={today} />
      </div>

      <TodaySyncFooter />
    </div>
  );
};
