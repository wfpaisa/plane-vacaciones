import { dayDate, daysBetween, toDate } from "./format";

export interface CalendarCell {
  date: Date;
  day: number;
  available: boolean;
}
export const monthIndex = (date: Date) => date.getFullYear() * 12 + date.getMonth();
export function calendarBounds(start: string, days: number[]): { first: number; last: number } | null {
  if (!days.length) return null;
  const first = dayDate(start, Math.min(...days));
  const last = dayDate(start, Math.max(...days));
  return first && last ? { first: monthIndex(first), last: monthIndex(last) } : null;
}

/** Semana de lunes a domingo; las fechas fuera de la ciudad elegida no se seleccionan. */
export function calendarMonth(start: string, month: number, days: number[]): (CalendarCell | null)[] {
  const beginning = toDate(start);
  if (!beginning) return [];
  const year = Math.floor(month / 12);
  const m = month % 12;
  const first = new Date(year, m, 1);
  const offset = (first.getDay() + 6) % 7;
  const length = new Date(year, m + 1, 0).getDate();
  const available = new Set(days);
  const size = Math.ceil((offset + length) / 7) * 7;
  return Array.from({ length: size }, (_, index) => {
    const n = index - offset + 1;
    if (n < 1 || n > length) return null;
    const date = new Date(year, m, n);
    const day = daysBetween(beginning, date) + 1;
    return { date, day, available: available.has(day) };
  });
}
