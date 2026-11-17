// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vite-plus/test";

import { Route } from "../routes/_auth/today";
import type { TodayScreen } from "./today-screen";

vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({}) }));
vi.mock("@/utils/orpc", () => ({
  orpc: {
    settings: { get: { queryOptions: () => ({}) } },
    goals: { list: { queryOptions: () => ({}) } },
    sessions: { list: { queryOptions: () => ({}) } },
  },
}));
vi.mock("@/lib/offline", () => ({ useLocalSessions: () => [] }));
vi.mock("@/lib/today-cache", () => ({
  readTodayCache: () => ({ settings: [], goals: { active: [], archived: [] } }),
}));
vi.mock("@/lib/today", () => ({
  resolveTodaySettings: () => ({
    today: "2026-11-17",
    current: { weekStartsOn: 1 },
  }),
  buildTodayView: () => ({}),
}));
vi.mock("@/components/today-screen", () => ({
  TodayScreen: ({
    openGoalId,
    onOpenDetails,
    onCloseDetails,
  }: Parameters<typeof TodayScreen>[0]) =>
    createElement(
      "div",
      null,
      createElement(
        "button",
        {
          "aria-expanded": openGoalId === "reading",
          onClick: () => onOpenDetails("reading"),
        },
        "Reading"
      ),
      createElement(
        "button",
        {
          "aria-expanded": openGoalId === "guitar",
          onClick: () => onOpenDetails("guitar"),
        },
        "Guitar"
      ),
      openGoalId
        ? createElement("button", { onClick: onCloseDetails }, "Close details")
        : null
    ),
}));

it("toggles the same goal closed, switches goals, and restores focus after closing", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const { component } = Route.options;
  if (!component) {
    throw new Error("Today route has no component");
  }
  try {
    await act(() => {
      root.render(createElement(component));
    });
    const buttons = container.querySelectorAll("button");
    const reading = buttons.item(0);
    const guitar = buttons.item(1);
    await act(() => {
      reading.focus();
      reading.click();
    });
    expect(reading.getAttribute("aria-expanded")).toBe("true");
    await act(() => {
      reading.click();
    });
    expect(reading.getAttribute("aria-expanded")).toBe("false");
    expect(container.textContent).not.toContain("Close details");
    await act(() => {
      reading.click();
    });
    await act(() => {
      guitar.focus();
      guitar.click();
    });
    expect(reading.getAttribute("aria-expanded")).toBe("false");
    expect(guitar.getAttribute("aria-expanded")).toBe("true");
    const close = container.querySelectorAll("button").item(2);
    await act(() => {
      close.focus();
      close.click();
    });
    expect(guitar.getAttribute("aria-expanded")).toBe("false");
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(guitar);
    });
  } finally {
    await act(() => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  }
});
