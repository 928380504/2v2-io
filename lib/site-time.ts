import { SITE_TIME_ZONE } from "../config/site-time";

interface CalendarDayParts {
  year: number;
  month: number;
  day: number;
}

interface ZonedDateTimeParts extends CalendarDayParts {
  hour: number;
  minute: number;
  second: number;
}

const SITE_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: SITE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function parseCalendarDay(dayKey: string): CalendarDayParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function formatCalendarDay({ year, month, day }: CalendarDayParts) {
  return [year, month, day]
    .map((value, index) =>
      index === 0 ? String(value).padStart(4, "0") : String(value).padStart(2, "0"),
    )
    .join("-");
}

function zonedParts(timestamp: number): ZonedDateTimeParts {
  const values: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {};
  for (const part of SITE_DATE_TIME_FORMATTER.formatToParts(timestamp)) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function timeZoneOffsetAt(timestamp: number) {
  const parts = zonedParts(timestamp);
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return representedAsUtc - Math.floor(timestamp / 1000) * 1000;
}

function shiftCalendarDay(dayKey: string, amount: number) {
  const parts = parseCalendarDay(dayKey);
  if (!parts) throw new RangeError(`Invalid calendar day: ${dayKey}`);
  const shifted = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + amount),
  );
  return formatCalendarDay({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  });
}

export function isValidSiteDay(dayKey: string) {
  return parseCalendarDay(dayKey) !== null;
}

export function siteDayKey(timestamp = Date.now()) {
  const { year, month, day } = zonedParts(timestamp);
  return formatCalendarDay({ year, month, day });
}

export function previousSiteDay(dayKey: string) {
  return shiftCalendarDay(dayKey, -1);
}

export function nextSiteDay(dayKey: string) {
  return shiftCalendarDay(dayKey, 1);
}

export function siteDayStart(dayKey: string) {
  const parts = parseCalendarDay(dayKey);
  if (!parts) throw new RangeError(`Invalid calendar day: ${dayKey}`);

  const utcMidnightGuess = Date.UTC(parts.year, parts.month - 1, parts.day);
  let timestamp = utcMidnightGuess;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    timestamp = utcMidnightGuess - timeZoneOffsetAt(timestamp);
  }
  return timestamp;
}

export function nextSiteDayReset(timestamp = Date.now()) {
  return siteDayStart(nextSiteDay(siteDayKey(timestamp)));
}
