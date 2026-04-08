import type { ScheduledTaskScheduleConfig } from "../config/scheduled-task-config.js";

const weekdayToIndex = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6
} as const;

export function getNextScheduledRun(schedule: ScheduledTaskScheduleConfig, fromDate: Date): Date {
  switch (schedule.kind) {
    case "everyHours":
      return new Date(fromDate.getTime() + schedule.intervalHours * 60 * 60 * 1000);
    case "daily":
      return getNextDailyRun(schedule.time, fromDate);
    case "weekly":
      return getNextWeeklyRun(schedule.days, schedule.time, fromDate);
    default:
      return assertNever(schedule);
  }
}

function getNextDailyRun(time: string, fromDate: Date): Date {
  const [hours, minutes] = parseTime(time);
  const candidate = new Date(fromDate);
  candidate.setHours(hours, minutes, 0, 0);

  if (candidate.getTime() >= fromDate.getTime()) {
    return candidate;
  }

  candidate.setDate(candidate.getDate() + 1);
  return candidate;
}

function getNextWeeklyRun(days: readonly string[], time: string, fromDate: Date): Date {
  const [hours, minutes] = parseTime(time);
  const dayIndexes: number[] = days.map((day) => weekdayToIndex[day as keyof typeof weekdayToIndex]);

  for (let offset = 0; offset < 7; offset += 1) {
    const candidate = new Date(fromDate);
    candidate.setDate(candidate.getDate() + offset);
    candidate.setHours(hours, minutes, 0, 0);

    if (!dayIndexes.includes(candidate.getDay())) {
      continue;
    }

    if (candidate.getTime() >= fromDate.getTime()) {
      return candidate;
    }
  }

  const candidate = new Date(fromDate);
  candidate.setDate(candidate.getDate() + 7);
  candidate.setHours(hours, minutes, 0, 0);
  return candidate;
}

function parseTime(time: string): [number, number] {
  const [hoursRaw, minutesRaw] = time.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new Error(`Invalid scheduled task time: ${time}`);
  }

  return [hours, minutes];
}

function assertNever(value: never): never {
  throw new Error(`Unsupported schedule: ${JSON.stringify(value)}`);
}
