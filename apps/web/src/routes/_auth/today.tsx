import type { GoalDto } from "@mostly/api/routers/goals";
import { weekStartOf } from "@mostly/domain";
import { Button } from "@mostly/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { PendingUndo } from "@/components/today-screen";
import { TodayScreen } from "@/components/today-screen";
import {
  cacheServerSessions,
  deleteLocalSession,
  markSessionDone,
  useLocalSessions,
} from "@/lib/offline";
import { detectedTimeZone } from "@/lib/time";
import { buildTodayView, resolveTodaySettings } from "@/lib/today";
import type { TodayCache } from "@/lib/today-cache";
import {
  readTodayCache,
  writeGoalsCache,
  writeSettingsCache,
} from "@/lib/today-cache";
import { orpc } from "@/utils/orpc";

const UNDO_MS = 5000;

const TodayPage = () => {
  const [now, setNow] = useState(() => new Date());
  const cache = useMemo<TodayCache>(() => readTodayCache(), []);
  const [undo, setUndo] = useState<PendingUndo | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [openGoalId, setOpenGoalId] = useState<string | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggers = useRef(new Map<string, HTMLButtonElement>());
  const sessions = useLocalSessions();
  const registerTrigger = useCallback(
    (goalId: string, node: HTMLButtonElement | null) => {
      if (node) {
        triggers.current.set(goalId, node);
      } else {
        triggers.current.delete(goalId);
      }
    },
    []
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(
    () => () => {
      if (undoTimer.current) {
        clearTimeout(undoTimer.current);
      }
    },
    []
  );

  const settingsQuery = useQuery({
    ...orpc.settings.get.queryOptions({
      input: { timeZone: detectedTimeZone() },
    }),
    meta: { suppressErrorToast: true },
  });
  const goalsQuery = useQuery({
    ...orpc.goals.list.queryOptions(),
    meta: { suppressErrorToast: true },
  });

  const history = settingsQuery.data?.history ?? cache.settings;
  const resolved = useMemo(
    () => (history ? resolveTodaySettings(history, now) : null),
    [history, now]
  );
  const today = resolved?.today ?? null;
  const settings = resolved?.current ?? null;
  const goalsData = goalsQuery.data ?? cache.goals;

  const weekStart =
    today && settings ? weekStartOf(today, settings.weekStartsOn) : null;
  const sessionRange = {
    from: weekStart ?? "1970-01-01",
    to: today ?? "1970-01-01",
  };
  const sessionsQuery = useQuery({
    ...orpc.sessions.list.queryOptions({ input: sessionRange }),
    enabled: Boolean(weekStart && today),
    meta: { suppressErrorToast: true },
  });

  useEffect(() => {
    if (sessionsQuery.data) {
      cacheServerSessions(sessionsQuery.data);
    }
  }, [sessionsQuery.data]);

  useEffect(() => {
    if (goalsQuery.data) {
      writeGoalsCache(goalsQuery.data);
    }
  }, [goalsQuery.data]);

  useEffect(() => {
    if (settingsQuery.data) {
      writeSettingsCache(settingsQuery.data.history);
    }
  }, [settingsQuery.data]);

  const allGoals = useMemo(
    () => (goalsData ? [...goalsData.active, ...goalsData.archived] : []),
    [goalsData]
  );
  const view = useMemo(
    () =>
      today && settings && goalsData
        ? buildTodayView({
            goals: allGoals,
            sessions,
            today,
            weekStartsOn: settings.weekStartsOn,
          })
        : null,
    [allGoals, goalsData, sessions, settings, today]
  );

  if (!(today && settings && view)) {
    const failed =
      !cache.goals &&
      !cache.settings &&
      (settingsQuery.isError || goalsQuery.isError);

    return (
      <div className="max-w-[720px] py-4">
        <h1 className="text-[28px] leading-tight font-medium">Today</h1>
        {failed ? (
          <div className="mt-6 space-y-3">
            <p role="alert" className="text-sm">
              Could not load Today.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void settingsQuery.refetch();
                void goalsQuery.refetch();
              }}
              className="min-h-11 rounded-full px-4 text-sm"
            >
              Retry
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground mt-6 text-sm">Loading today…</p>
        )}
      </div>
    );
  }

  const clearUndo = () => {
    if (undoTimer.current) {
      clearTimeout(undoTimer.current);
      undoTimer.current = null;
    }
    setUndo(null);
  };

  const markDone = (goal: GoalDto) => {
    const existing = sessions.find(
      (entry) => entry.goalId === goal.id && entry.logicalDate === today
    );
    if (existing) {
      return;
    }

    markSessionDone({ goalId: goal.id, logicalDate: today });
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.vibrate === "function"
    ) {
      navigator.vibrate(10);
    }

    if (undoTimer.current) {
      clearTimeout(undoTimer.current);
    }
    setUndo({ goalId: goal.id, logicalDate: today, name: goal.name });
    undoTimer.current = setTimeout(() => {
      undoTimer.current = null;
      setUndo(null);
    }, UNDO_MS);
    setAnnouncement(`${goal.name} done. Undo available for 5 seconds.`);
  };

  const handleUndo = () => {
    if (!undo) {
      return;
    }
    const session = sessions.find(
      (entry) =>
        entry.goalId === undo.goalId && entry.logicalDate === undo.logicalDate
    );
    if (session) {
      deleteLocalSession(session.id);
    }
    clearUndo();
    setAnnouncement(`${undo.name} undone.`);
  };

  const focusRow = (goalId: string) => {
    requestAnimationFrame(() => triggers.current.get(goalId)?.focus());
  };

  const openDetails = (goalId: string) => {
    if (undo?.goalId === goalId) {
      clearUndo();
    }
    setOpenGoalId(goalId);
  };

  const closeDetails = () => {
    const goalId = openGoalId;
    setOpenGoalId(null);
    if (goalId) {
      focusRow(goalId);
    }
  };

  const handleRemoved = (goalName: string) => {
    const goalId = openGoalId;
    setOpenGoalId(null);
    setAnnouncement(`${goalName} marked not done.`);
    if (goalId) {
      focusRow(goalId);
    }
  };

  return (
    <TodayScreen
      view={view}
      today={today}
      settings={settings}
      now={now}
      hasAnyGoal={allGoals.length > 0}
      undo={undo}
      announcement={announcement}
      openGoalId={openGoalId}
      onMarkDone={markDone}
      onUndo={handleUndo}
      onOpenDetails={openDetails}
      onCloseDetails={closeDetails}
      onRemoved={handleRemoved}
      registerTrigger={registerTrigger}
    />
  );
};

export const Route = createFileRoute("/_auth/today")({
  component: TodayPage,
});
