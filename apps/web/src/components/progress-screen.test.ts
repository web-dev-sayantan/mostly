import type { ProgressGoalCard, ProgressResult } from "@mostly/domain";
import { addLogicalDays } from "@mostly/domain";
import { createElement } from "react";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";

import {
  ProgressHeatmap,
  buildWeekColumns,
  hoveredDaySummary,
} from "./progress-heatmap";
import { ProgressScreen, cardMetaCopy } from "./progress-screen";

vi.mock("@/lib/goals", () => import("../lib/goals"));
vi.mock("@/lib/stats-format", () => import("../lib/stats-format"));
vi.mock("@/lib/time", () => import("../lib/time"));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params,
    children,
    ...rest
  }: {
    to: string;
    params?: Record<string, string>;
    children?: ReactNode;
    [key: string]: unknown;
  }) => {
    let href = to;
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        href = href.replace(`$${key}`, value);
      }
    }
    return createElement("a", { ...rest, href }, children);
  },
}));

const makeHeatmapDays = (today: string): ProgressResult["heatmap"]["days"] => {
  const start = addLogicalDays(today, -83);
  return Array.from({ length: 84 }, (_, index) => {
    const date = addLogicalDays(start, index);
    return {
      date,
      expected: 3,
      done: index === 83 ? 2 : 3,
      extras: index === 82 ? 1 : 0,
      intensity: index === 83 ? "medium" : "full",
    };
  });
};

const makeResult = (
  overrides: Partial<ProgressResult> = {}
): ProgressResult => {
  const today = "2026-11-17";
  return {
    today,
    range: 30,
    weekStartsOn: 1,
    empty: false,
    todayProgress: {
      date: today,
      done: 2,
      total: 3,
      incomplete: true,
      goals: [
        {
          goalId: "reading",
          name: "Reading",
          emoji: "📖",
          color: null,
          done: true,
        },
        {
          goalId: "writing",
          name: "Writing",
          emoji: "✍️",
          color: null,
          done: false,
        },
      ],
    },
    hero: {
      consistency: {
        percent: 82,
        qualifying: 2,
        total: 3,
        notEnoughData: false,
      },
      sessions: 18,
      minutes: {
        total: 90,
        sessions: 18,
        withMinutes: 4,
        average: 23,
      },
    },
    heatmap: {
      weekStartsOn: 1,
      days: makeHeatmapDays(today),
    },
    weekly: [
      {
        goalId: "guitar",
        name: "Guitar",
        emoji: "🎸",
        color: null,
        target: 3,
        weeks: [
          {
            weekStart: "2026-11-09",
            weekEnd: "2026-11-15",
            target: 3,
            sessions: 3,
            activeDays: 7,
            status: "met",
            outcome: "met",
          },
          {
            weekStart: "2026-11-16",
            weekEnd: "2026-11-22",
            target: 3,
            sessions: 2,
            activeDays: 2,
            status: "partial",
            outcome: "in_progress",
          },
        ],
      },
    ],
    cards: [
      {
        goalId: "reading",
        name: "Reading",
        emoji: "📖",
        color: null,
        priority: "high",
        unit: "day",
        currentStreak: 5,
        consistency: { done: 24, expected: 28, percent: 86, qualified: true },
        days: [
          { date: "2026-11-16", status: "done", extra: false },
          { date: "2026-11-17", status: "done", extra: false },
        ],
        weeks: [],
      },
      {
        goalId: "writing",
        name: "Writing",
        emoji: "✍️",
        color: null,
        priority: "low",
        unit: "day",
        currentStreak: 0,
        consistency: { done: 2, expected: 4, percent: null, qualified: false },
        days: [
          { date: "2026-11-16", status: "missed", extra: false },
          { date: "2026-11-17", status: "open", extra: false },
        ],
        weeks: [],
      },
      {
        goalId: "guitar",
        name: "Guitar",
        emoji: "🎸",
        color: null,
        priority: "medium",
        unit: "week",
        currentStreak: 2,
        consistency: { done: 3, expected: 4, percent: 75, qualified: true },
        days: [],
        weeks: [
          {
            weekStart: "2026-11-09",
            weekEnd: "2026-11-15",
            target: 3,
            sessions: 3,
            activeDays: 7,
            status: "met",
            outcome: "met",
          },
          {
            weekStart: "2026-11-16",
            weekEnd: "2026-11-22",
            target: 3,
            sessions: 2,
            activeDays: 2,
            status: "partial",
            outcome: "in_progress",
          },
        ],
      },
    ],
    ...overrides,
  };
};

describe("ProgressScreen", () => {
  it("declutters goal cards and consolidates weekly goals without duplicate sections", () => {
    const html = renderToStaticMarkup(
      createElement(ProgressScreen, {
        result: makeResult(),
        range: 30,
        onRangeChange: vi.fn(),
      })
    );

    expect(html).not.toContain("Weekly targets");
    expect(html).not.toContain("consistency · 30 days");
    expect(html).not.toContain("No streak yet");
    expect(html).not.toContain("High");
    expect(html).not.toContain("Medium");
    expect(html).not.toContain("Low");

    expect(html).toContain("5d streak");
    expect(html).toContain("86%");
    expect(html).toContain("2 of 4");
    expect(html).toContain("2/3 this week · 2w streak");
    expect(html).toContain("75%");
    expect(html).toContain("Last 30 days");
    expect(html).toContain("2 of 3 today");

    const guitarLinks = html.match(/href="\/goals\/guitar"/gu) ?? [];
    expect(guitarLinks).toHaveLength(1);
  });

  it("shows balanced hero stats and omits Time when fewer than 3 timed sessions", () => {
    const withTime = renderToStaticMarkup(
      createElement(ProgressScreen, {
        result: makeResult(),
        range: 30,
        onRangeChange: vi.fn(),
      })
    );

    expect(withTime).toContain("82%");
    expect(withTime).toContain("2 of 3 goals");
    expect(withTime).toContain("18");
    expect(withTime).toContain("1 h 30 min");
    expect(withTime).toContain("4/18 logged");

    const withoutTime = renderToStaticMarkup(
      createElement(ProgressScreen, {
        result: makeResult({
          hero: {
            consistency: {
              percent: 82,
              qualifying: 3,
              total: 3,
              notEnoughData: false,
            },
            sessions: 5,
            minutes: { total: 40, sessions: 5, withMinutes: 2, average: 20 },
          },
        }),
        range: 30,
        onRangeChange: vi.fn(),
      })
    );

    expect(withoutTime).toContain("Consistency");
    expect(withoutTime).toContain("Sessions");
    expect(withoutTime).not.toContain(">Time<");
    expect(withoutTime).not.toContain("3 of 3 goals");
  });

  it("renders empty state when history is under a week", () => {
    const html = renderToStaticMarkup(
      createElement(ProgressScreen, {
        result: makeResult({
          empty: true,
          todayProgress: {
            date: "2026-11-17",
            done: 0,
            total: 0,
            incomplete: false,
            goals: [],
          },
        }),
        range: 30,
        onRangeChange: vi.fn(),
      })
    );

    expect(html).toContain("Progress fills in after a week.");
    expect(html).toContain("Nothing scheduled today.");
    expect(html).not.toContain("<table");
  });
});

describe("cardMetaCopy", () => {
  it("omits empty streak for daily goals and hides not_scored current week", () => {
    const dailyZero: ProgressGoalCard = {
      goalId: "a",
      name: "A",
      emoji: null,
      color: null,
      priority: "medium",
      unit: "day",
      currentStreak: 0,
      consistency: { done: 0, expected: 0, percent: null, qualified: false },
      days: [],
      weeks: [],
    };
    expect(cardMetaCopy(dailyZero)).toBeNull();

    const weeklyNotScored: ProgressGoalCard = {
      goalId: "b",
      name: "B",
      emoji: null,
      color: null,
      priority: "medium",
      unit: "week",
      currentStreak: 0,
      consistency: { done: 0, expected: 0, percent: null, qualified: false },
      days: [],
      weeks: [
        {
          weekStart: "2026-11-16",
          weekEnd: "2026-11-22",
          target: 3,
          sessions: 1,
          activeDays: 1,
          status: "not_scored",
          outcome: "not_scored",
        },
      ],
    };
    expect(cardMetaCopy(weeklyNotScored)).toBeNull();
  });
});

describe("ProgressHeatmap", () => {
  it("renders month headers and legend in chart mode", () => {
    const html = renderToStaticMarkup(
      createElement(ProgressHeatmap, {
        heatmap: makeResult().heatmap,
        today: "2026-11-17",
      })
    );

    expect(html).toContain("Less");
    expect(html).toContain("More");
    expect(html).toContain("Extra");
    expect(html).toContain("Nov");
  });

  it("renders table rows newest-first", () => {
    const html = renderToStaticMarkup(
      createElement(ProgressHeatmap, {
        heatmap: makeResult().heatmap,
        today: "2026-11-17",
        defaultAsTable: true,
      })
    );

    const firstDateIndex = html.indexOf('href="/day/2026-11-17"');
    const olderDateIndex = html.indexOf('href="/day/2026-11-16"');
    expect(firstDateIndex).toBeGreaterThan(-1);
    expect(olderDateIndex).toBeGreaterThan(firstDateIndex);
  });

  it("avoids overlapping month labels in adjacent first columns and formats hover summary", () => {
    const days = makeHeatmapDays("2026-11-17");
    const columns = buildWeekColumns(days);
    const labeledColumns = columns.filter(
      (column) => column.monthLabel !== null
    );
    expect(labeledColumns.length).toBeGreaterThanOrEqual(2);

    expect(
      hoveredDaySummary(
        {
          date: "2026-11-16",
          expected: 3,
          done: 2,
          extras: 1,
          intensity: "medium",
        },
        "2026-11-17"
      )
    ).toBe("16 Nov · 2/3 done · 1 extra");
  });
});
