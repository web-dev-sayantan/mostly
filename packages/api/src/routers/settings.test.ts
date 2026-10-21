import type { Database } from "@mostly/db";
import { createTestDb } from "@mostly/db/testing";
import { settingsForDate } from "@mostly/domain";
import { createRouterClient } from "@orpc/server";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { createTestContext, createTestUser } from "../testing";
import { appRouter } from "./index";

const NOW = new Date("2026-10-21T12:00:00Z");
const clock = () => NOW;

const clientFor = (
  db: Database,
  session: Awaited<ReturnType<typeof createTestUser>>
) =>
  createRouterClient(appRouter, {
    context: createTestContext(db, session, clock),
  });

describe("settings router", () => {
  let db: Database;
  let close: () => void;
  let alice: Awaited<ReturnType<typeof createTestUser>>;
  let bob: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => {
    ({ db, close } = await createTestDb());
    alice = await createTestUser(db, {
      email: "alice@example.com",
      name: "Alice",
    });
    bob = await createTestUser(db, { email: "bob@example.com", name: "Bob" });
  });

  afterEach(() => {
    close();
  });

  it("seeds Monday and 4 AM from the detected timezone on first use", async () => {
    const client = clientFor(db, alice);

    const settings = await client.settings.get({ timeZone: "Asia/Tokyo" });

    expect(settings.today).toBe("2026-10-21");
    expect(settings.current).toMatchObject({
      effectiveFrom: "2026-10-21",
      timeZone: "Asia/Tokyo",
      weekStartsOn: 1,
      dayRolloverHour: 4,
    });
    expect(settings.history).toHaveLength(1);
  });

  it("falls back to UTC when the detected timezone is missing or invalid", async () => {
    const client = clientFor(db, alice);

    const first = await client.settings.get({});
    expect(first.current.timeZone).toBe("UTC");

    const second = await clientFor(db, bob).settings.get({
      timeZone: "Not/AZone",
    });
    expect(second.current.timeZone).toBe("UTC");
  });

  it("does not seed a second version on later reads", async () => {
    const client = clientFor(db, alice);

    await client.settings.get({ timeZone: "Asia/Tokyo" });
    const again = await client.settings.get({ timeZone: "Asia/Tokyo" });

    expect(again.history).toHaveLength(1);
  });

  it("applies a rollover change from the next logical day and keeps today's value", async () => {
    const client = clientFor(db, alice);
    await client.settings.get({ timeZone: "UTC" });

    const result = await client.settings.update({ dayRolloverHour: 2 });

    expect(result.current.dayRolloverHour).toBe(4);
    expect(result.change).toMatchObject({
      dayRolloverChanged: true,
      weekStartChanged: false,
      timeZoneChanged: false,
      weeklyStreakReset: false,
      transitionWeek: null,
    });
    expect(result.change?.versions).toEqual([
      {
        effectiveFrom: "2026-10-22",
        timeZone: "UTC",
        weekStartsOn: 1,
        dayRolloverHour: 2,
      },
    ]);
    expect(settingsForDate(result.history, "2026-10-21")?.dayRolloverHour).toBe(
      4
    );
    expect(settingsForDate(result.history, "2026-10-22")?.dayRolloverHour).toBe(
      2
    );
  });

  it("requires explicit confirmation before a timezone change", async () => {
    const client = clientFor(db, alice);
    await client.settings.get({ timeZone: "UTC" });

    await expect(
      client.settings.update({ timeZone: "Europe/Berlin" })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });

    const result = await client.settings.update({
      timeZone: "Europe/Berlin",
      confirmTimeZone: true,
    });

    expect(result.change?.timeZoneChanged).toBe(true);
    expect(result.change?.versions[0]?.effectiveFrom).toBe("2026-10-22");
    expect(settingsForDate(result.history, "2026-10-21")?.timeZone).toBe("UTC");
    expect(settingsForDate(result.history, "2026-10-22")?.timeZone).toBe(
      "Europe/Berlin"
    );
  });

  it("records the date a dateline jump skips and returns no expectations for it", async () => {
    const client = clientFor(db, alice);
    await client.settings.get({ timeZone: "Pacific/Pago_Pago" });

    const result = await client.settings.update({
      timeZone: "Pacific/Kiritimati",
      confirmTimeZone: true,
    });
    const skipped = result.history.find(
      (version) => version.effectiveFrom === "2026-10-21"
    );

    expect(skipped?.skippedDates).toEqual(["2026-10-21"]);

    await client.goals.create({
      name: "Reading",
      emoji: null,
      color: null,
      priority: "medium",
      cadence: { type: "daily" },
      startDate: "2026-10-20",
    });
    const day = await client.days.get({ date: "2026-10-21" });

    expect(day).toMatchObject({
      skipped: true,
      readOnly: true,
      expectations: [],
      extras: [],
      weekly: [],
      candidates: [],
    });
  });

  it("applies a week-start change next week and flags the streak reset", async () => {
    const client = clientFor(db, alice);
    await client.settings.get({ timeZone: "UTC" });

    const result = await client.settings.update({ weekStartsOn: 7 });

    expect(result.current.weekStartsOn).toBe(1);
    expect(result.change).toMatchObject({
      weekStartChanged: true,
      weeklyStreakReset: true,
      transitionWeek: { start: "2026-10-19", end: "2026-10-24" },
    });
    expect(result.change?.versions).toEqual([
      {
        effectiveFrom: "2026-10-25",
        timeZone: "UTC",
        weekStartsOn: 7,
        dayRolloverHour: 4,
      },
    ]);
    expect(settingsForDate(result.history, "2026-10-24")?.weekStartsOn).toBe(1);
    expect(settingsForDate(result.history, "2026-10-25")?.weekStartsOn).toBe(7);
  });

  it("never rewrites the past when settings change again", async () => {
    const client = clientFor(db, alice);
    await client.settings.get({ timeZone: "UTC" });
    await client.settings.update({ weekStartsOn: 7 });
    await client.settings.update({ dayRolloverHour: 2 });

    const result = await client.settings.get({ timeZone: "UTC" });

    expect(result.history).toHaveLength(3);
    expect(settingsForDate(result.history, "2026-10-20")).toMatchObject({
      timeZone: "UTC",
      weekStartsOn: 1,
      dayRolloverHour: 4,
    });
    expect(settingsForDate(result.history, "2026-10-25")).toMatchObject({
      weekStartsOn: 7,
      dayRolloverHour: 4,
    });
    expect(settingsForDate(result.history, "2026-10-22")).toMatchObject({
      weekStartsOn: 1,
      dayRolloverHour: 2,
    });
  });

  it("keeps each user's history separate", async () => {
    const aliceClient = clientFor(db, alice);
    const bobClient = clientFor(db, bob);

    await aliceClient.settings.get({ timeZone: "UTC" });
    await bobClient.settings.get({ timeZone: "Asia/Tokyo" });
    await bobClient.settings.update({ weekStartsOn: 7 });

    const aliceSettings = await aliceClient.settings.get({ timeZone: "UTC" });
    const bobSettings = await bobClient.settings.get({
      timeZone: "Asia/Tokyo",
    });

    expect(aliceSettings.history).toHaveLength(1);
    expect(aliceSettings.current).toMatchObject({
      timeZone: "UTC",
      weekStartsOn: 1,
    });
    expect(bobSettings.history).toHaveLength(2);
    expect(bobSettings.current).toMatchObject({
      timeZone: "Asia/Tokyo",
      weekStartsOn: 1,
    });
  });

  it("rejects invalid timezones, week starts, rollovers, and empty updates", async () => {
    const client = clientFor(db, alice);

    await expect(
      client.settings.update({ timeZone: "Not/AZone", confirmTimeZone: true })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      client.settings.update({ weekStartsOn: 0 })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(
      client.settings.update({ weekStartsOn: 8 })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(
      client.settings.update({ dayRolloverHour: 7 })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(client.settings.update({})).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});
