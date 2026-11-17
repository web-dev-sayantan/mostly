import { describe, expect, it } from "vite-plus/test";

import { weekSegmentFor, weekSegments } from "./weeks";

const history = (entries: [effectiveFrom: string, weekStartsOn: number][]) =>
  entries.map(([effectiveFrom, weekStartsOn]) => ({
    effectiveFrom,
    weekStartsOn,
  }));

describe("weekSegments", () => {
  it("marks the Sunday to Monday transition week and starts the new era after it", () => {
    const segments = weekSegments(
      history([
        ["2020-01-01", 7],
        ["2026-10-26", 1],
      ]),
      "2026-10-04",
      "2026-11-08"
    );

    expect(segments).toEqual([
      { start: "2026-10-04", end: "2026-10-10", transition: false },
      { start: "2026-10-11", end: "2026-10-17", transition: false },
      { start: "2026-10-18", end: "2026-10-25", transition: true },
      { start: "2026-10-26", end: "2026-11-01", transition: false },
      { start: "2026-11-02", end: "2026-11-08", transition: false },
    ]);
  });

  it("marks the Monday to Sunday transition week without a phantom week", () => {
    const segments = weekSegments(
      history([
        ["2020-01-01", 1],
        ["2026-10-25", 7],
      ]),
      "2026-10-05",
      "2026-10-31"
    );

    expect(segments).toEqual([
      { start: "2026-10-05", end: "2026-10-11", transition: false },
      { start: "2026-10-12", end: "2026-10-18", transition: false },
      { start: "2026-10-19", end: "2026-10-24", transition: true },
      { start: "2026-10-25", end: "2026-10-31", transition: false },
    ]);
  });

  it("supports several week-start changes without overlapping weeks", () => {
    const segments = weekSegments(
      history([
        ["2020-01-01", 1],
        ["2026-10-11", 7],
        ["2026-10-26", 1],
      ]),
      "2026-09-28",
      "2026-11-01"
    );

    expect(segments).toEqual([
      { start: "2026-09-28", end: "2026-10-04", transition: false },
      { start: "2026-10-05", end: "2026-10-10", transition: true },
      { start: "2026-10-11", end: "2026-10-17", transition: false },
      { start: "2026-10-18", end: "2026-10-25", transition: true },
      { start: "2026-10-26", end: "2026-11-01", transition: false },
    ]);
    for (const [index, segment] of segments.entries()) {
      const next = segments[index + 1];
      if (next) {
        expect(segment.end < next.start).toBe(true);
      }
    }
  });

  it("returns the whole block containing a date inside a transition", () => {
    expect(
      weekSegmentFor(
        history([
          ["2020-01-01", 7],
          ["2026-10-26", 1],
        ]),
        "2026-10-20"
      )
    ).toEqual({ start: "2026-10-18", end: "2026-10-25", transition: true });
  });

  it("keeps weeks aligned when the range starts in the middle of a week", () => {
    expect(
      weekSegments(history([["2020-01-01", 1]]), "2026-10-21", "2026-10-22")
    ).toEqual([{ start: "2026-10-19", end: "2026-10-25", transition: false }]);
  });
});
