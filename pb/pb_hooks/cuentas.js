/**
 * Cuentas de la familia y enlaces de solo lectura. Las rutas viven en
 * cuentas.pb.js; aquí está la lógica para poder reutilizarla.
 */
const USERNAME = /^[a-z0-9._-]{3,30}$/;

function account(record) {
  return { id: record.id, username: record.getString("username"), name: record.getString("name"), is_admin: record.getBool("is_admin"), created: record.getString("created") };
}
function list(app) {
  return app.findRecordsByFilter("users", "", "created,id", 0, 0).map(account);
}
function checkPassword(password) {
  if (typeof password !== "string" || password.length < 10 || password.length > 72) throw new BadRequestError("La contraseña debe tener entre 10 y 72 caracteres.");
}
function create(app, body) {
  const username = String(body.username || "").trim().toLowerCase();
  const name = String(body.name || "").trim();
  if (!USERNAME.test(username)) throw new BadRequestError("El usuario debe tener de 3 a 30 letras minúsculas, números, puntos, guiones o guiones bajos.");
  if (name.length > 80) throw new BadRequestError("El nombre admite hasta 80 caracteres.");
  checkPassword(body.password);
  try {
    app.findFirstRecordByData("users", "username", username);
    throw new BadRequestError("Ese usuario ya existe. Elige otro.");
  } catch (err) {
    if (err instanceof BadRequestError) throw err;
  }
  const record = new Record(app.findCollectionByNameOrId("users"));
  record.set("username", username);
  record.set("name", name);
  record.setPassword(body.password);
  app.save(record);
  return account(record);
}
function changeOwn(app, record, body) {
  if (typeof body.current !== "string" || !record.validatePassword(body.current)) throw new BadRequestError("La contraseña actual no es correcta.");
  checkPassword(body.password);
  if (body.password === body.current) throw new BadRequestError("La nueva contraseña debe ser distinta de la actual.");
  record.setPassword(body.password);
  record.refreshTokenKey();
  app.save(record);
}
function reset(app, admin, id, body) {
  if (!admin.getBool("is_admin")) throw new ForbiddenError("Solo la cuenta administradora puede restablecer contraseñas.");
  checkPassword(body.password);
  const record = app.findRecordById("users", id);
  record.setPassword(body.password);
  // Cierra las sesiones abiertas de esa cuenta con la contraseña anterior.
  record.refreshTokenKey();
  app.save(record);
  return account(record);
}

function share(app, trip) {
  try { return app.findFirstRecordByData("trip_shares", "trip", trip).getString("token"); } catch (_) { return ""; }
}
function createShare(app, trip, user) {
  app.findRecordById("trips", trip);
  const token = $security.randomString(40);
  app.runInTransaction(tx => {
    try { tx.delete(tx.findFirstRecordByData("trip_shares", "trip", trip)); } catch (_) {}
    const record = new Record(tx.findCollectionByNameOrId("trip_shares"));
    record.set("trip", trip); record.set("token", token); record.set("created_by", user);
    tx.save(record);
  });
  return token;
}
function revokeShare(app, trip) {
  try { app.delete(app.findFirstRecordByData("trip_shares", "trip", trip)); } catch (_) {}
}
/** Lo que ve quien tiene el enlace: ruta, viajeros e itinerario. Sin gastos, presupuesto ni checklist. */
function shared(app, token) {
  if (typeof token !== "string" || token.length < 32) throw new NotFoundError("Enlace no válido.");
  let link;
  try { link = app.findFirstRecordByData("trip_shares", "token", token); } catch (_) { throw new NotFoundError("Este enlace ya no está disponible."); }
  const id = link.getString("trip");
  const pick = (record, keys) => { const all = record.publicExport(); const out = {}; for (const k of keys) out[k] = all[k]; return out; };
  const rows = (collection, sort, keys) => app.findRecordsByFilter(collection, "trip={:trip}", sort, 0, 0, { trip: id }).map(r => pick(r, keys));
  const base = ["id", "collectionId", "collectionName", "created", "trip"];
  return {
    trip: pick(app.findRecordById("trips", id), ["id", "name", "origin", "destination", "lat", "lng", "start_date", "end_date", "cover", "notes"]),
    stops: rows("stops", "position,created,id", [...base, "name", "address", "country", "lat", "lng", "nights", "transport", "position", "notes"]),
    travelers: rows("travelers", "created,id", [...base, "name", "emoji", "color", "portrait", "avatar_variant"]),
    places: rows("places", "day,position,created,id", [...base, "stop", "name", "address", "lat", "lng", "category", "day", "position", "time", "link", "notes"]),
  };
}

module.exports = { list, account, create, changeOwn, reset, share, createShare, revokeShare, shared };
