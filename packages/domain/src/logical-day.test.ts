import { describe, expect, it } from "vite-plus/test";

import { logicalDate } from "./logical-day";

describe("logicalDate", () => {
  it("keeps the previous day open until the 4 AM rollover", () => {
    const settings = { timeZone: "UTC", rolloverHour: 4 };

    expect(logicalDate(new Date("2026-10-20T03:59:00Z"), settings)).toBe("2026-10-19");
    expect(logicalDate(new Date("2026-10-20T04:00:00Z"), settings)).toBe("2026-10-20");
  });

  it("uses the IANA timezone, not UTC or the machine's local zone", () => {
    const instant = new Date("2026-10-19T20:00:00Z");

    expect(logicalDate(instant, { timeZone: "Asia/Tokyo", rolloverHour: 4 })).toBe("2026-10-20");
    expect(logicalDate(instant, { timeZone: "America/Los_Angeles", rolloverHour: 4 })).toBe(
      "2026-10-19",
    );
  });

  it("handles a daylight-saving transition", () => {
    const settings = { timeZone: "America/New_York", rolloverHour: 4 };

    // 03:59 EDT, before the fall-back. 04:00 EST, after it.
    expect(logicalDate(new Date("2026-11-01T07:59:00Z"), settings)).toBe("2026-10-31");
    expect(logicalDate(new Date("2026-11-01T09:00:00Z"), settings)).toBe("2026-11-01");
  });
});
