/**
 * All bakery time is Manila time.
 *
 * The Philippines sits at UTC+08:00 and has had no daylight saving since 1978,
 * so a fixed offset is exact here. That matters: a Thursday 11:59 p.m. cutoff
 * must mean the same wall-clock moment whether the server runs in Manila, on a
 * US East region, or on the owner's laptop.
 */

export const MANILA_TZ = "Asia/Manila";
const OFFSET_MS = 8 * 60 * 60 * 1000;

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export interface ManilaParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0 = Sunday
}

/** Reads an instant as Manila wall-clock fields. */
export function manilaParts(date: Date): ManilaParts {
  const shifted = new Date(date.getTime() + OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

/** Builds the instant for a Manila wall-clock moment. */
export function fromManila(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0) - OFFSET_MS);
}

/** Midnight at the start of the Manila day containing `date`. */
export function manilaStartOfDay(date: Date): Date {
  const p = manilaParts(date);
  return fromManila(p.year, p.month, p.day, 0, 0);
}

export function manilaEndOfDay(date: Date): Date {
  return new Date(manilaStartOfDay(date).getTime() + 24 * 60 * 60 * 1000 - 1);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/** "2026-09-27" in Manila, the key used for prep-date lists and month rows. */
export function manilaDateKey(date: Date): string {
  const p = manilaParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** "2026-09", the key for an Overhead row. */
export function manilaMonthKey(date: Date): string {
  const p = manilaParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}`;
}

/**
 * The next time `weekday` falls at `hour:minute` in Manila, strictly after
 * `from`. Used for the cutoff and for pickup dates.
 */
export function nextWeekdayAt(from: Date, weekday: number, hour: number, minute: number): Date {
  const p = manilaParts(from);
  let delta = (weekday - p.weekday + 7) % 7;
  let candidate = fromManila(p.year, p.month, p.day + delta, hour, minute);
  if (candidate.getTime() <= from.getTime()) {
    delta += 7;
    candidate = fromManila(p.year, p.month, p.day + delta, hour, minute);
  }
  return candidate;
}

export interface WeeklySchedule {
  cutoffWeekday: number;
  cutoffHour: number;
  cutoffMinute: number;
  prepWeekdays: number[];
  pickupWeekday: number;
}

export interface BakeCycle {
  /** Orders open the moment the previous week's cutoff passes. */
  orderOpensAt: Date;
  cutoffAt: Date;
  /** Manila date keys for the baking days, in order. */
  prepDates: string[];
  pickupDate: Date;
}

/**
 * Works out the cycle a customer is currently ordering into.
 *
 * Thursday cutoff, bake Friday–Sunday, deliver Sat–Sun, collect Sunday.
 * Once Thursday 11:59 p.m. passes, this rolls forward to the next week.
 */
export function bakeCycleFor(now: Date, schedule: WeeklySchedule): BakeCycle {
  const cutoffAt = nextWeekdayAt(
    now,
    schedule.cutoffWeekday,
    schedule.cutoffHour,
    schedule.cutoffMinute,
  );
  const pickupDate = nextWeekdayAt(cutoffAt, schedule.pickupWeekday, 0, 0);

  const prepDates: string[] = [];
  for (let offset = 1; offset <= 7; offset += 1) {
    const day = addDays(cutoffAt, offset);
    if (manilaDateKey(day) > manilaDateKey(pickupDate)) break;
    const weekday = manilaParts(day).weekday;
    if (schedule.prepWeekdays.includes(weekday)) prepDates.push(manilaDateKey(day));
  }

  return {
    orderOpensAt: addDays(cutoffAt, -7),
    cutoffAt,
    prepDates,
    pickupDate,
  };
}

export function parsePrepWeekdays(csv: string): number[] {
  return csv
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
}

/** True once the cutoff has passed, evaluated at request time rather than cached. */
export function isPastCutoff(cutoffAt: Date, now = new Date()): boolean {
  return now.getTime() > cutoffAt.getTime();
}

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  expired: boolean;
}

export function countdown(target: Date, now = new Date()): Countdown {
  const totalMs = Math.max(0, target.getTime() - now.getTime());
  const totalSeconds = Math.floor(totalMs / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    totalMs,
    expired: totalMs === 0,
  };
}

const dayFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: MANILA_TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
});

const shortDayFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: MANILA_TZ,
  day: "numeric",
  month: "short",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: MANILA_TZ,
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: MANILA_TZ,
  hour: "numeric",
  minute: "2-digit",
});

/** "Sunday, 27 September" */
export function formatDay(date: Date): string {
  return dayFormatter.format(date);
}

/** "27 Sep" */
export function formatDayShort(date: Date): string {
  return shortDayFormatter.format(date);
}

/** "Thu, 24 Sep, 11:59 PM" */
export function formatDateTime(date: Date): string {
  return dateTimeFormatter.format(date);
}

export function formatTime(date: Date): string {
  return timeFormatter.format(date);
}

/** Turns "08:00" into "8:00 AM" for slot cards. */
export function formatClock(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h)) return hhmm;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m ?? 0).padStart(2, "0")} ${period}`;
}

/** Month label for reports: "September 2026". */
export function formatMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return monthKey;
  return new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric" }).format(
    fromManila(year, month, 1, 12, 0),
  );
}
