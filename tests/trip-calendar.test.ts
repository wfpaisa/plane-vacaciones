import { expect, test } from "bun:test";
import { calendarBounds, calendarMonth, monthIndex } from "../web/src/lib/tripCalendar";

test("alinea octubre con lunes y relaciona las fechas con los días reales del viaje", () => {
  const month = monthIndex(new Date(2027, 9, 1));
  const cells = calendarMonth("2027-10-14 12:00:00Z", month, [1, 2, 3, 4, 5]);
  expect(cells.slice(0, 4)).toEqual([null, null, null, null]);
  expect(cells[4]?.date.getDate()).toBe(1);
  const arrival = cells.find(c => c?.date.getDate() === 14);
  expect(arrival?.day).toBe(1); expect(arrival?.available).toBe(true);
  expect(cells.find(c => c?.date.getDate() === 13)?.available).toBe(false);
  expect(cells.find(c => c?.date.getDate() === 19)?.available).toBe(false);
});

test("la ciudad elegida habilita solamente sus días, incluido el traslado compartido", () => {
  const month = monthIndex(new Date(2027, 9, 1));
  const first = calendarMonth("2027-10-14", month, [1, 2, 3, 4, 5]);
  const second = calendarMonth("2027-10-14", month, [5, 6, 7, 8]);
  expect(first.find(c => c?.day === 5)?.available).toBe(true);
  expect(second.find(c => c?.day === 5)?.available).toBe(true);
  expect(second.find(c => c?.day === 4)?.available).toBe(false);
  expect(first.find(c => c?.day === 6)?.available).toBe(false);
});

test("permite navegar entre meses y años sin perder el número de día", () => {
  const range = [1, 2, 3, 4, 5];
  const bounds = calendarBounds("2027-12-30", range)!;
  expect(bounds.last - bounds.first).toBe(1);
  const january = calendarMonth("2027-12-30", bounds.last, range);
  const first = january.find(c => c?.date.getDate() === 1);
  expect(first?.date.getFullYear()).toBe(2028); expect(first?.day).toBe(3); expect(first?.available).toBe(true);
});

test("incluye el 29 de febrero y devuelve un calendario vacío si no hay fechas", () => {
  const cells = calendarMonth("2028-02-28", monthIndex(new Date(2028, 1, 1)), [1, 2, 3]);
  expect(cells.find(c => c?.date.getDate() === 29)?.day).toBe(2);
  expect(calendarMonth("", 0, [1, 2])).toEqual([]);
  expect(calendarBounds("", [1, 2])).toBeNull();
  expect(calendarBounds("2027-10-14", [])).toBeNull();
});
