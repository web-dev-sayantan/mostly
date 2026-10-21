import type {
  DayDetailDto,
  DayGoalDto,
  DaySessionDto,
} from "@mostly/api/routers/days";
import { describe, expect, it } from "vite-plus/test";

import { cacheDayDetail, cachedDayDetail } from "./day-cache";
import type { StorageLike } from "./offline/store";

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const goal: DayGoalDto = {
  id: "reading",
  name: "Reading",
  emoji: null,
  color: null,
  priority: "medium",
  startDate: "2026-10-01",
  archivedOn: null,
  cadence: { type: "daily" },
};

const session: DaySessionDto = {
  id: "session-1",
  goalId: goal.id,
  logicalDate: "2026-10-20",
  minutes: 30,
  note: "A private note",
  mood: "great",
  updatedAt: 1000,
  deletedAt: null,
};

const day: DayDetailDto = {
  date: "2026-10-20",
  today: "2026-10-20",
  readOnly: false,
  weekStartsOn: 1,
  timeZone: "UTC",
  dayRolloverHour: 4,
  expectations: [{ goal, status: "done", session, editable: true }],
  extras: [],
  weekly: [],
  candidates: [],
  weekSessions: [session],
};

describe("day cache", () => {
  it("keeps notes and moods in the offline session store only", () => {
    const storage = new MemoryStorage();
    cacheDayDetail(day, storage);

    const cached = cachedDayDetail(day.date, storage);

    expect(cached?.expectations[0]?.session).toMatchObject({
      minutes: 30,
      note: null,
      mood: null,
    });
    expect(cached?.weekSessions[0]).toMatchObject({ note: null, mood: null });
    expect(storage.getItem("mostly:day-cache")).not.toContain("A private note");
  });

  it("returns null for a day that was never cached", () => {
    expect(cachedDayDetail("2026-10-19", new MemoryStorage())).toBeNull();
  });
});
