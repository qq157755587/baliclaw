import { describe, expect, it } from "vitest";
import { getNextScheduledRun } from "../src/daemon/scheduled-task-schedule.js";

describe("getNextScheduledRun", () => {
  it("schedules everyHours relative to now", () => {
    const now = new Date("2026-04-08T01:15:00.000Z");
    const next = getNextScheduledRun(
      {
        kind: "everyHours",
        intervalHours: 6
      },
      now
    );

    expect(next.toISOString()).toBe("2026-04-08T07:15:00.000Z");
  });

  it("schedules daily later on the same day when still in the future", () => {
    const fromDate = new Date(2026, 3, 8, 8, 30, 0, 0);
    const next = getNextScheduledRun(
      {
        kind: "daily",
        time: "09:00"
      },
      fromDate
    );

    expect(next.getFullYear()).toBe(2026);
    expect(next.getMonth()).toBe(3);
    expect(next.getDate()).toBe(8);
    expect(next.getHours()).toBe(9);
    expect(next.getMinutes()).toBe(0);
  });

  it("schedules daily on the next day when the time has passed", () => {
    const fromDate = new Date(2026, 3, 8, 10, 0, 0, 0);
    const next = getNextScheduledRun(
      {
        kind: "daily",
        time: "09:00"
      },
      fromDate
    );

    expect(next.getFullYear()).toBe(2026);
    expect(next.getMonth()).toBe(3);
    expect(next.getDate()).toBe(9);
    expect(next.getHours()).toBe(9);
    expect(next.getMinutes()).toBe(0);
  });

  it("treats a daily task at the exact target minute as due now", () => {
    const fromDate = new Date(2026, 3, 8, 9, 0, 0, 0);
    const next = getNextScheduledRun(
      {
        kind: "daily",
        time: "09:00"
      },
      fromDate
    );

    expect(next.getFullYear()).toBe(2026);
    expect(next.getMonth()).toBe(3);
    expect(next.getDate()).toBe(8);
    expect(next.getHours()).toBe(9);
    expect(next.getMinutes()).toBe(0);
  });

  it("schedules weekly on the next matching weekday", () => {
    const fromDate = new Date(2026, 3, 9, 10, 0, 0, 0);
    const next = getNextScheduledRun(
      {
        kind: "weekly",
        days: ["mon", "wed"],
        time: "18:30"
      },
      fromDate
    );

    expect(next.getDay()).toBe(1);
    expect(next.getHours()).toBe(18);
    expect(next.getMinutes()).toBe(30);
  });

  it("treats a weekly task at the exact target minute on a matching weekday as due now", () => {
    const fromDate = new Date(2026, 3, 8, 9, 0, 0, 0);
    const next = getNextScheduledRun(
      {
        kind: "weekly",
        days: ["wed"],
        time: "09:00"
      },
      fromDate
    );

    expect(next.getFullYear()).toBe(2026);
    expect(next.getMonth()).toBe(3);
    expect(next.getDate()).toBe(8);
    expect(next.getDay()).toBe(3);
    expect(next.getHours()).toBe(9);
    expect(next.getMinutes()).toBe(0);
  });
});
