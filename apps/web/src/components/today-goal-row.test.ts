// @vitest-environment happy-dom
import type { GoalDto } from "@mostly/api/routers/goals";
import { act, createElement } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vite-plus/test";

import type { LocalSession } from "../lib/offline/store";
import { TodayGoalRow, WeeklyGoalRow } from "./today-goal-row";

const goal: GoalDto = {
  id: "reading",
  name: "Reading",
  emoji: "📖",
  color: null,
  priority: "medium",
  startDate: "2026-10-01",
  archivedOn: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  sessionCount: 0,
  scheduleVersions: [],
};
const session: LocalSession = {
  id: "session",
  goalId: goal.id,
  logicalDate: "2026-11-17",
  minutes: 20,
  note: null,
  mood: null,
  updatedAt: 1,
  pending: true,
};
const container = document.createElement("ul");
document.body.append(container);
const root = createRoot(container);
vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
const render = async (node: ReactNode) => {
  await act(() => {
    root.render(node);
  });
};
const button = (label: string) => {
  const target = container.querySelector<HTMLButtonElement>(
    `button[aria-label="${label}"]`
  );
  if (!target) {
    throw new Error(`Missing button: ${label}`);
  }
  return target;
};
const props = () => ({
  detailsOpen: false,
  undoActive: false,
  onMarkDone: vi.fn(),
  onOpenDetails: vi.fn(),
  onUndo: vi.fn(),
  onRegisterAction: vi.fn(),
});

afterEach(async () => {
  await render(null);
});

it("completes from the goal name and registers the full row for focus", async () => {
  const handlers = props();
  await render(
    createElement(TodayGoalRow, {
      ...handlers,
      entry: { goal, cadence: { type: "daily" }, session: null },
    })
  );
  const target = button("Mark Reading done");
  expect(container.querySelectorAll("button")).toHaveLength(1);
  expect(target.textContent).toContain("Reading");
  expect(target.getAttribute("aria-expanded")).toBeNull();
  await act(() => {
    target.querySelector("span")?.click();
  });
  expect(handlers.onMarkDone).toHaveBeenCalledExactlyOnceWith(goal);
  expect(handlers.onOpenDetails).not.toHaveBeenCalled();
  expect(handlers.onRegisterAction).toHaveBeenCalledWith(goal.id, target);
});

it("uses the completed row for details and exposes accordion state", async () => {
  const handlers = props();
  const entry = { goal, cadence: { type: "daily" as const }, session };
  await render(createElement(TodayGoalRow, { ...handlers, entry }));
  const target = button("Reading done. Edit details.");
  expect(container.querySelectorAll("button")).toHaveLength(1);
  expect(target.getAttribute("aria-expanded")).toBe("false");
  expect(target.getAttribute("aria-controls")).toBe(`today-panel-${goal.id}`);
  await act(() => {
    target.click();
  });
  expect(handlers.onOpenDetails).toHaveBeenCalledExactlyOnceWith(goal.id);
  expect(handlers.onMarkDone).not.toHaveBeenCalled();
  await render(
    createElement(TodayGoalRow, {
      ...handlers,
      entry,
      detailsOpen: true,
      details: createElement(
        "section",
        { id: `today-panel-${goal.id}` },
        "Details"
      ),
    })
  );
  expect(target.getAttribute("aria-expanded")).toBe("true");
  await act(() => {
    target.click();
  });
  expect(handlers.onOpenDetails).toHaveBeenCalledTimes(2);
});

it("keeps Undo and the post-completion details shortcut outside the row button", async () => {
  const handlers = props();
  await render(
    createElement(TodayGoalRow, {
      ...handlers,
      undoActive: true,
      entry: { goal, cadence: { type: "daily" }, session },
    })
  );
  expect(container.querySelector("button button")).toBeNull();
  await act(() => {
    button("Add details for Reading").click();
  });
  expect(handlers.onOpenDetails).toHaveBeenCalledExactlyOnceWith(goal.id);
  await act(() => {
    button("Undo Reading").click();
  });
  expect(handlers.onUndo).toHaveBeenCalledOnce();
  expect(handlers.onMarkDone).not.toHaveBeenCalled();
});

it.each([false, true])(
  "completes weekly goals across the full row when target met is %s",
  async (met) => {
    const handlers = props();
    await render(
      createElement(WeeklyGoalRow, {
        ...handlers,
        entry: {
          goal,
          session: null,
          target: 2,
          count: met ? 2 : 1,
          scored: true,
          met,
          weekStart: "2026-11-16",
          weekEnd: "2026-11-22",
        },
      })
    );
    expect(container.querySelectorAll("button")).toHaveLength(1);
    await act(() => {
      button(
        met ? "Log another session for Reading" : "Mark Reading done"
      ).click();
    });
    expect(handlers.onMarkDone).toHaveBeenCalledExactlyOnceWith(goal);
  }
);
