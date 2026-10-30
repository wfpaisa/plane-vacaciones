function limit(name, fallback) {
  const raw = $os.getenv(name);
  if (!raw) return fallback;
  const n = Number(raw);
  // Una configuración inválida desactiva el servicio, en vez de dejarlo sin límite.
  return Number.isInteger(n) && n >= 0 ? n : 0;
}
function month() {
  // Google contabiliza los meses según la hora del Pacífico.
  const now = new Date();
  const year = now.getUTCFullYear();
  const sunday = (m, n) => {
    const first = new Date(Date.UTC(year, m, 1));
    return 1 + (7 - first.getUTCDay()) % 7 + (n - 1) * 7;
  };
  const start = Date.UTC(year, 2, sunday(2, 2), 10);
  const end = Date.UTC(year, 10, sunday(10, 1), 9);
  const offset = now.getTime() >= start && now.getTime() < end ? 7 : 8;
  return new Date(now.getTime() - offset * 3600000).toISOString().slice(0, 7);
}
function used(app, service) {
  const row = new DynamicModel({ used: 0 });
  app.db().newQuery("SELECT COALESCE(SUM(used), 0) AS used FROM google_usage WHERE month={:month} AND service={:service}")
    .bind({ month: month(), service }).one(row);
  return row.used;
}
function reserve(app, service, cap) {
  if (!cap) return false;
  let allowed = false;
  app.runInTransaction((tx) => {
    const params = { month: month(), service, cap };
    tx.db().newQuery("INSERT OR IGNORE INTO google_usage (month, service, used) VALUES ({:month}, {:service}, 0)").bind(params).execute();
    const result = tx.db().newQuery("UPDATE google_usage SET used=used+1 WHERE month={:month} AND service={:service} AND used < {:cap}").bind(params).execute();
    allowed = result.rowsAffected() === 1;
  });
  // La reserva se mantiene si falla Google: evita subestimar solicitudes enviadas.
  return allowed;
}
module.exports = { limit, month, used, reserve };
