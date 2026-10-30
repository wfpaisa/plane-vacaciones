/**
 * Las cuentas de la familia: quién puso cuánto, a quién le toca cuánto y la
 * forma más corta de quedar a paz y salvo.
 */
import type { Expense, Traveler } from "./types";

export interface Balance {
  traveler: Traveler;
  paid: number;
  share: number;
  /** Positivo: le deben. Negativo: debe. */
  net: number;
}

export interface Transfer {
  from: Traveler;
  to: Traveler;
  amount: number;
}

export function balances(expenses: Expense[], travelers: Traveler[]): Balance[] {
  const map = new Map(travelers.map((t) => [t.id, { traveler: t, paid: 0, share: 0, net: 0 }]));
  for (const e of expenses) {
    if (e.status !== "pagado" || !e.amount) continue;
    const among = (e.split?.length ? e.split : travelers.map((t) => t.id)).filter((id) => map.has(id));
    if (!among.length) continue;
    const part = e.amount / among.length;
    // Pagado individualmente: cada uno puso su propia parte.
    if (e.paid_individually) for (const id of among) map.get(id)!.paid += part;
    else {
      const payer = map.get(e.paid_by);
      if (payer) payer.paid += e.amount;
    }
    for (const id of among) map.get(id)!.share += part;
  }
  for (const b of map.values()) b.net = b.paid - b.share;
  return [...map.values()];
}

export function settleUp(list: Balance[]): Transfer[] {
  const eps = 0.5;
  const creditors = list.filter((b) => b.net > eps).map((b) => ({ ...b }));
  const debtors = list.filter((b) => b.net < -eps).map((b) => ({ ...b, net: -b.net }));
  creditors.sort((a, b) => b.net - a.net);
  debtors.sort((a, b) => b.net - a.net);
  const out: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].net, creditors[j].net);
    out.push({ from: debtors[i].traveler, to: creditors[j].traveler, amount });
    debtors[i].net -= amount;
    creditors[j].net -= amount;
    if (debtors[i].net <= eps) i++;
    if (creditors[j].net <= eps) j++;
  }
  return out;
}
