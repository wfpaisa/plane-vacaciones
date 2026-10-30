export type ExchangeRate = {
  base: string;
  target: string;
  rate: number;
  date: string;
  source: "trm" | "market";
  expires: number;
};

const cacheKey = (base: string, target: string) => `vacaciones-tasa-${base}-${target}`;

function readCache(base: string, target: string): ExchangeRate | null {
  try {
    const value = localStorage.getItem(cacheKey(base, target));
    if (!value) return null;
    const rate = JSON.parse(value) as ExchangeRate;
    return rate.base === base && rate.target === target && Number.isFinite(rate.rate) && rate.rate > 0 ? rate : null;
  } catch {
    return null;
  }
}

function saveCache(rate: ExchangeRate) {
  try {
    localStorage.setItem(cacheKey(rate.base, rate.target), JSON.stringify(rate));
  } catch {}
}

async function officialTrm(base: string, target: string): Promise<ExchangeRate> {
  const url = new URL("https://www.datos.gov.co/resource/mcec-87by.json");
  url.searchParams.set("$select", "valor,vigenciadesde,vigenciahasta");
  url.searchParams.set("$order", "vigenciadesde DESC");
  url.searchParams.set("$limit", "1");
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("No se pudo consultar la TRM.");
  const rows = (await response.json()) as { valor?: string; vigenciadesde?: string }[];
  const value = Number(rows[0]?.valor);
  const date = rows[0]?.vigenciadesde?.slice(0, 10) ?? "";
  if (!date || !Number.isFinite(value) || value <= 0 || Date.now() - Date.parse(date) > 7 * 86_400_000)
    throw new Error("La TRM disponible no está actualizada.");
  return { base, target, rate: base === "USD" ? value : 1 / value, date, source: "trm", expires: Date.now() + 12 * 3_600_000 };
}

async function marketRate(base: string, target: string): Promise<ExchangeRate> {
  const response = await fetch(`https://open.er-api.com/v6/latest/${base}`, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("No se pudo consultar la tasa de cambio.");
  const data = (await response.json()) as {
    result?: string;
    base_code?: string;
    rates?: Record<string, number>;
    time_last_update_unix?: number;
    time_next_update_unix?: number;
  };
  const rate = data.rates?.[target];
  if (data.result !== "success" || data.base_code !== base || !rate || !Number.isFinite(rate) || rate <= 0)
    throw new Error("No hay una tasa de cambio disponible para estas monedas.");
  const updated = data.time_last_update_unix ? new Date(data.time_last_update_unix * 1000) : new Date();
  return {
    base,
    target,
    rate,
    date: updated.toISOString().slice(0, 10),
    source: "market",
    expires: Math.max(Date.now() + 3_600_000, Math.min((data.time_next_update_unix ?? 0) * 1000, Date.now() + 24 * 3_600_000)),
  };
}

export async function getExchangeRate(base: string, target: string): Promise<ExchangeRate> {
  const cached = readCache(base, target);
  if (cached && cached.expires > Date.now()) return cached;
  try {
    const rate = (base === "USD" && target === "COP") || (base === "COP" && target === "USD")
      ? await officialTrm(base, target).catch(() => marketRate(base, target))
      : await marketRate(base, target);
    saveCache(rate);
    return rate;
  } catch (error) {
    if (cached && Date.now() - Date.parse(cached.date) <= 7 * 86_400_000) return { ...cached, expires: 0 };
    throw error;
  }
}

export const exchangeSource = (rate: ExchangeRate) =>
  rate.source === "trm"
    ? { label: "TRM oficial · Superfinanciera", url: "https://www.datos.gov.co/Econom-a-y-Finanzas/Tasa-de-Cambio-Representativa-del-Mercado-Historic/mcec-87by" }
    : { label: "Tasa diaria · Exchange Rate API", url: "https://www.exchangerate-api.com" };
