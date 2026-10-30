/**
 * El recorrido de un viaje con varias paradas.
 *
 * Las paradas van en orden y cada una dura `nights` noches. La primera empieza
 * el día 1; la siguiente, el día en que termina la anterior. Ese día de
 * traslado pertenece a las dos: se sale de una y se llega a la otra.
 */
import { distanceKm, hasCoords } from "./geo";
import type { Stop } from "./types";

export interface Leg {
  stop: Stop;
  index: number;
  firstDay: number;
  lastDay: number;
  /** Km en línea recta desde la parada anterior. */
  km: number;
}

export const sortStops = (stops: Stop[]) =>
  [...stops].sort((a, b) => a.position - b.position || a.created.localeCompare(b.created));

export function schedule(stops: Stop[]): Leg[] {
  let day = 1;
  const sorted = sortStops(stops);
  return sorted.map((stop, index) => {
    const prev = sorted[index - 1];
    const leg: Leg = {
      stop,
      index,
      firstDay: day,
      lastDay: day + Math.max(0, stop.nights),
      km: prev && hasCoords(prev) && hasCoords(stop) ? distanceKm(prev, stop) : 0,
    };
    day = leg.lastDay;
    return leg;
  });
}

export const totalNights = (stops: Stop[]) => stops.reduce((a, s) => a + Math.max(0, s.nights), 0);

/** Las paradas de un día: una sola, o dos si es día de traslado. */
export const legsOfDay = (legs: Leg[], day: number) => legs.filter((l) => day >= l.firstDay && day <= l.lastDay);

/** La parada en la que se duerme ese día (la de llegada, si hay traslado). */
export function stopOfDay(legs: Leg[], day: number): Stop | null {
  const found = legsOfDay(legs, day);
  return found.length ? found[found.length - 1].stop : null;
}

/** La parada más cercana a un punto, para asignar los lugares solos. */
export function nearestStop(stops: Stop[], p: { lat: number; lng: number }): Stop | null {
  let best: Stop | null = null;
  let min = Infinity;
  for (const s of stops) {
    if (!hasCoords(s)) continue;
    const d = distanceKm(s, p);
    if (d < min) {
      min = d;
      best = s;
    }
  }
  return best;
}

/** "París" a partir de lo que devuelve el buscador. */
export function countryOf(address: string): string {
  const parts = address.split(",").map((x) => x.trim()).filter(Boolean);
  return parts[parts.length - 1] ?? "";
}
