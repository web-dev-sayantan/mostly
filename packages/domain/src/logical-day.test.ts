import { describe, expect, it } from "vite-plus/test";

import {
  addLogicalDays,
  isBeforeRollover,
  isWithinLastLogicalDays,
  logicalDate,
  weekEndOf,
  weekStartOf,
  weekdayOf,
} from "./logical-day";

describe("logicalDate", () => {
  it("keeps the previous day open until the 4 AM rollover", () => {
    const settings = { timeZone: "UTC", rolloverHour: 4 };

    expect(logicalDate(new Date("2026-10-20T03:59:00Z"), settings)).toBe("2026-10-19");
    expect(logicalDate(new Date("2026-10-20T04:00:00Z"), settings)).toBe("2026-10-20");
  });

  it("honours a midnight and a 6 AM rollover", () => {
    const instant = new Date("2026-10-20T05:59:00Z");

    expect(logicalDate(instant, { timeZone: "UTC", rolloverHour: 0 })).toBe("2026-10-20");
    expect(logicalDate(instant, { timeZone: "UTC", rolloverHour: 6 })).toBe("2026-10-19");
    expect(logicalDate(new Date("2026-10-20T06:00:00Z"), { timeZone: "UTC", rolloverHour: 6 })).toBe(
      "2026-10-20",
    );
  });

  it("uses the IANA timezone, not UTC or the machine's local zone", () => {
    const instant = new Date("2026-10-19T20:00:00Z");

    expect(logicalDate(instant, { timeZone: "Asia/Tokyo", rolloverHour: 4 })).toBe("2026-10-20");
    expect(logicalDate(instant, { timeZone: "America/Los_Angeles", rolloverHour: 4 })).toBe(
      "2026-10-19",
    );
  });

  it("handles the spring-forward gap", () => {
    const settings = { timeZone: "America/New_York", rolloverHour: 4 };

    // 01:59 EST, then 03:30 EDT after the clocks jump from 02:00 to 03:00.
    expect(logicalDate(new Date("2026-03-08T06:59:00Z"), settings)).toBe("2026-03-07");
    expect(logicalDate(new Date("2026-03-08T07:30:00Z"), settings)).toBe("2026-03-07");
    expect(logicalDate(new Date("2026-03-08T08:00:00Z"), settings)).toBe("2026-03-08");
  });

  it("handles the fall-back hour", () => {
    const settings = { timeZone: "America/New_York", rolloverHour: 4 };

    // Both 01:30 EDT and the repeated 01:30 EST still belong to 31 October.
    expect(logicalDate(new Date("2026-11-01T05:30:00Z"), settings)).toBe("2026-10-31");
    expect(logicalDate(new Date("2026-11-01T06:30:00Z"), settings)).toBe("2026-10-31");
    expect(logicalDate(new Date("2026-11-01T08:00:00Z"), settings)).toBe("2026-10-31");
    expect(logicalDate(new Date("2026-11-01T09:00:00Z"), settings)).toBe("2026-11-01");
  });

  it("handles non-whole-hour timezone offsets", () => {
    const kolkata = { timeZone: "Asia/Kolkata", rolloverHour: 4 };
    const kathmandu = { timeZone: "Asia/Kathmandu", rolloverHour: 4 };

    // 23:59 and 00:00 in Kolkata, both before rollover.
    expect(logicalDate(new Date("2026-10-20T18:29:00Z"), kolkata)).toBe("2026-10-20");
    expect(logicalDate(new Date("2026-10-20T18:30:00Z"), kolkata)).toBe("2026-10-20");
    expect(logicalDate(new Date("2026-10-20T22:30:00Z"), kolkata)).toBe("2026-10-21");
    // 00:15 in Kathmandu (+05:45).
    expect(logicalDate(new Date("2026-10-20T18:30:00Z"), kathmandu)).toBe("2026-10-20");
  });

  it("maps the same instant to logical dates in different IANA zones", () => {
    const instant = new Date("2026-10-20T18:00:00Z");
    const read = (timeZone: string) => logicalDate(instant, { timeZone, rolloverHour: 4 });

    expect(read("Pacific/Kiritimati")).toBe("2026-10-21");
    expect(read("Asia/Tokyo")).toBe("2026-10-20");
    expect(read("America/Los_Angeles")).toBe("2026-10-20");
    expect(read("Pacific/Pago_Pago")).toBe("2026-10-20");
  });
});

describe("logical date helpers", () => {
  it("numbers weekdays Monday 1 through Sunday 7", () => {
    expect(weekdayOf("2026-10-19")).toBe(1);
    expect(weekdayOf("2026-10-20")).toBe(2);
    expect(weekdayOf("2026-10-25")).toBe(7);
  });

  it("adds days across month and year boundaries", () => {
    expect(addLogicalDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addLogicalDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addLogicalDays("2026-10-20", 0)).toBe("2026-10-20");
  });

  it("finds the week start and end under a Monday or Sunday setting", () => {
    expect(weekStartOf("2026-10-21", 1)).toBe("2026-10-19");
    expect(weekEndOf("2026-10-21", 1)).toBe("2026-10-25");
    expect(weekStartOf("2026-10-21", 7)).toBe("2026-10-18");
    expect(weekEndOf("2026-10-21", 7)).toBe("2026-10-24");
    expect(weekStartOf("2026-10-19", 1)).toBe("2026-10-19");
    expect(weekStartOf("2026-10-25", 7)).toBe("2026-10-25");
  });

  it("treats the last seven logical days, today included, as the window", () => {
    expect(isWithinLastLogicalDays("2026-10-20", "2026-10-20")).toBe(true);
    expect(isWithinLastLogicalDays("2026-10-14", "2026-10-20")).toBe(true);
    expect(isWithinLastLogicalDays("2026-10-13", "2026-10-20")).toBe(false);
    expect(isWithinLastLogicalDays("2026-10-21", "2026-10-20")).toBe(false);
    expect(isWithinLastLogicalDays("2026-10-20", "2026-10-20", 1)).toBe(true);
    expect(isWithinLastLogicalDays("2026-10-19", "2026-10-20", 1)).toBe(false);
  });
});

describe("isBeforeRollover", () => {
  it("is true between midnight and the configured rollover", () => {
    const settings = { timeZone: "UTC", rolloverHour: 4 };

    expect(isBeforeRollover(new Date("2026-10-20T00:00:00Z"), settings)).toBe(true);
    expect(isBeforeRollover(new Date("2026-10-20T03:59:00Z"), settings)).toBe(true);
    expect(isBeforeRollover(new Date("2026-10-20T04:00:00Z"), settings)).toBe(false);
  });

  it("uses the user's timezone", () => {
    const settings = { timeZone: "Asia/Tokyo", rolloverHour: 4 };

    expect(isBeforeRollover(new Date("2026-10-20T18:59:00Z"), settings)).toBe(true);
    expect(isBeforeRollover(new Date("2026-10-20T19:00:00Z"), settings)).toBe(false);
  });
});
