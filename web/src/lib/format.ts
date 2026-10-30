/** Fechas y dinero en español. */

const DAY = 86_400_000;

/** PocketBase guarda "2026-11-03 00:00:00.000Z"; aquí solo importa el día. */
export function toDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** De "2026-11-03 00:00:00.000Z" a "2026-11-03", para un `<input type="date">`. */
export const toInput = (value: string | undefined | null) => (value ? value.slice(0, 10) : "");

/** Del `<input type="date">` a lo que entiende PocketBase. */
export const fromInput = (value: string) => (value ? `${value} 12:00:00.000Z` : "");

export function today(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

export const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY);

/** Cuántos días dura el viaje, contando el de llegada y el de regreso. */
export function tripLength(start: string, end: string): number {
  const a = toDate(start);
  const b = toDate(end);
  if (!a || !b) return 0;
  return Math.max(0, daysBetween(a, b) + 1);
}

/** La fecha del día `n` (1 = el primero). */
export function dayDate(start: string, n: number): Date | null {
  const a = toDate(start);
  if (!a) return null;
  return new Date(a.getFullYear(), a.getMonth(), a.getDate() + n - 1);
}

const fmtShort = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" });
const fmtWeek = new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "numeric", month: "short" });
const fmtLong = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric" });

export const shortDate = (d: Date | null) => (d ? fmtShort.format(d).replace(".", "") : "");
export function weekDate(d: Date | null): string {
  if (!d) return "";
  const s = fmtWeek.format(d).replace(/\./g, "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export const longDate = (d: Date | null) => (d ? fmtLong.format(d) : "");

export function dateRange(start: string, end: string): string {
  const a = toDate(start);
  const b = toDate(end);
  if (!a) return "Sin fechas";
  if (!b) return shortDate(a);
  const sameYear = a.getFullYear() === b.getFullYear();
  return `${shortDate(a)} – ${shortDate(b)}${sameYear ? ` ${b.getFullYear()}` : ""}`;
}

/** "Faltan 12 días", "¡Es mañana!", "Día 3 de 7", "Ya volvimos". */
export function countdown(start: string, end: string): { label: string; tone: "soon" | "now" | "past" | "none" } {
  const a = toDate(start);
  const b = toDate(end) ?? a;
  if (!a || !b) return { label: "Sin fechas", tone: "none" };
  const t = today();
  const until = daysBetween(t, a);
  if (until > 1) return { label: `Faltan ${until} días`, tone: "soon" };
  if (until === 1) return { label: "¡Es mañana!", tone: "soon" };
  if (daysBetween(t, b) >= 0) {
    return { label: `Día ${daysBetween(a, t) + 1} de ${daysBetween(a, b) + 1}`, tone: "now" };
  }
  return { label: "Ya volvimos", tone: "past" };
}

const money = new Map<string, Intl.NumberFormat>();
export function formatMoney(amount: number, currency = "COP"): string {
  const code = currency || "COP";
  let f = money.get(code);
  if (!f) {
    const whole = ["COP", "CLP", "ARS"].includes(code);
    f = new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: code,
      maximumFractionDigits: whole ? 0 : 2,
      minimumFractionDigits: 0,
    });
    money.set(code, f);
  }
  return f.format(amount || 0);
}

/** "$ 1,2 M" para las cifras grandes de los indicadores. */
export function compactMoney(amount: number, currency = "COP"): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: currency || "COP",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount || 0);
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
