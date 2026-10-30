const CONTEXT = {
  application: "Vacaciones", language: "es", scope: "Viajes compartidos de la familia. No hay reservas ni pagos reales.",
  workflow: ["Pregunta siempre primero por el lugar de origen (ciudad desde donde sale el grupo) si el viaje no tiene trip.origin, aunque el usuario no lo mencione; guárdalo en trip.origin. No propongas la ruta sin conocerlo.", "Pregunta por destino, fecha de salida, duración, presupuesto, moneda y viajeros.", "Con el origen, planea el trayecto de ida hasta la primera ciudad (transport de esa ciudad), el regreso desde la última y sus gastos de transporte estimados.", "Consulta get_context y get_trip antes de modificar un viaje.", "Propón ciudades en orden, noches, transporte, lugares realistas por día y tiempos de desplazamiento.", "Usa create_trip para crear todo en una transacción o add_trip_items para ampliar el viaje sin borrar sus datos.", "Para corregir elementos existentes usa update_trip_items con los id de get_trip; para quitarlos, delete_trip_items solo cuando el usuario lo pida.", "Si el usuario indica un viaje existente (trip_id o nombre en list_trips), aunque esté vacío, no uses create_trip: completa ese viaje con update_trip para los datos generales y add_trip_items para el contenido.", "Incluye request_key único y reutilízalo al reintentar la misma creación para no duplicarla.", "Usa search_locations para verificar coordenadas y conserva geo_provider y google_place_id. No inventes horarios, precios ni reservas confirmadas: verifica con fuentes externas y marca las estimaciones en notes.", "La salida se calcula sumando las noches de las ciudades; día 1 = fecha de salida; día 0 = idea sin asignar.", "stop_index, paid_by_index, split_indices y assignee_indices son índices desde 0 de las listas correspondientes; al añadir elementos usan las listas devueltas por get_trip."],
  currencies: ["COP", "EUR", "USD", "MXN", "ARS", "BRL", "PEN", "CLP"],
  covers: ["mar", "selva", "montana", "desierto", "ciudad", "nieve", "menta", "rosa", "ambar", "petroleo", "lavanda", "lima"],
  transport: ["avion", "tren", "bus", "carro", "barco", "otro"],
  place_categories: ["alojamiento", "comida", "atraccion", "naturaleza", "playa", "compras", "transporte", "otro"],
  expense_categories: ["transporte", "alojamiento", "comida", "actividades", "compras", "otros"],
};
CONTEXT.cover_labels = { mar: "Azul índigo", selva: "Verde jade", montana: "Grafito", desierto: "Coral", ciudad: "Violeta", nieve: "Azul glaciar", menta: "Menta", rosa: "Rosa", ambar: "Ámbar", petroleo: "Petróleo", lavanda: "Lavanda", lima: "Lima" };
const str = { type: "string" }, num = { type: "number" }, bool = { type: "boolean" }, index = { type: "integer", minimum: 0 };
function obj(properties, required = []) { return { type: "object", properties, required, additionalProperties: false }; }
const tripSchema = obj({ name: str, origin: { type: "string", maxLength: 200, description: "Ciudad de origen desde donde sale el grupo" }, destination: str, start_date: { type: "string", description: "YYYY-MM-DD" }, end_date: str, budget: { type: "number", minimum: 0 }, currency: str, secondary_currency: str, cover: { type: "string", enum: CONTEXT.covers }, notes: str, lat: num, lng: num, category_budgets: { type: "object", additionalProperties: { type: "number", minimum: 0 } } }, ["name", "start_date", "currency"]);
const itemSchemas = {
  stops: obj({ name: str, address: str, country: str, lat: num, lng: num, nights: index, transport: { type: "string", enum: CONTEXT.transport }, notes: str, geo_provider: str, google_place_id: str }, ["name", "nights", "transport"]),
  travelers: obj({ name: str, color: str, emoji: str }, ["name"]),
  places: obj({ name: str, address: str, lat: num, lng: num, category: { type: "string", enum: CONTEXT.place_categories }, day: index, time: { type: "string", pattern: "^([01][0-9]|2[0-3]):[0-5][0-9]$" }, cost: { type: "number", minimum: 0 }, link: str, notes: str, stop_index: index, geo_provider: str, google_place_id: str }, ["name", "category", "day"]),
  expenses: obj({ title: str, category: { type: "string", enum: CONTEXT.expense_categories }, amount: { type: "number", minimum: 0 }, date: str, status: { type: "string", enum: ["planeado", "pagado"] }, stop_index: index, paid_by_index: index, paid_individually: { type: "boolean", description: "true si cada viajero de split pagó su parte por aparte; entonces no se usa paid_by_index" }, split_indices: { type: "array", items: index }, notes: str }, ["title", "category", "amount"]),
  checklist: obj({ title: str, kind: { type: "string", enum: ["group", "individual"] }, assign_all: bool, assignee_indices: { type: "array", items: index } }, ["title", "kind"]),
};
const arrays = {}, patches = {}, ids = {};
for (const key of Object.keys(itemSchemas)) {
  arrays[key] = { type: "array", maxItems: 300, items: itemSchemas[key] };
  patches[key] = { type: "array", maxItems: 300, items: obj({ id: str, ...itemSchemas[key].properties }, ["id"]) };
  ids[key] = { type: "array", maxItems: 300, items: str };
}
const COLLECTIONS = { stops: "stops", travelers: "travelers", places: "places", expenses: "expenses", checklist: "checklist_items" };
const TOOLS = [
  { name: "get_context", description: "Reglas, categorías, esquema y guía para planificar vacaciones en esta aplicación.", inputSchema: obj({}), annotations: { readOnlyHint: true } },
  { name: "list_trips", description: "Lista hasta 100 viajes compartidos existentes.", inputSchema: obj({}), annotations: { readOnlyHint: true } },
  { name: "search_locations", description: "Busca ciudades y lugares en Google Places para obtener coordenadas verificadas, respetando la cuota mensual de la aplicación.", inputSchema: obj({ query: { type: "string", minLength: 3, maxLength: 300 }, lat: num, lng: num }, ["query"]), annotations: { readOnlyHint: true, openWorldHint: true } },
  { name: "get_trip", description: "Contexto completo de un viaje: ciudades, viajeros, lugares, gastos y checklist, con IDs e índices para ampliarlo.", inputSchema: obj({ trip_id: str }, ["trip_id"]), annotations: { readOnlyHint: true } },
  { name: "create_trip", description: "Crea un viaje completo y todas sus listas de forma atómica. request_key evita duplicados al reintentar.", inputSchema: obj({ request_key: str, trip: tripSchema, ...arrays }, ["request_key", "trip"]), annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true } },
  { name: "update_trip", description: "Actualiza datos generales y notas de un viaje. Las fechas de regreso se recalculan según sus ciudades.", inputSchema: obj({ trip_id: str, trip: { ...tripSchema, required: [] } }, ["trip_id", "trip"]), annotations: { readOnlyHint: false, destructiveHint: false } },
  { name: "update_trip_items", description: "Edita ciudades, viajeros, lugares, gastos o checklist existentes por su id (de get_trip). Solo cambia los campos enviados; operación atómica.", inputSchema: obj({ trip_id: str, ...patches }, ["trip_id"]), annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true } },
  { name: "delete_trip_items", description: "Elimina ciudades, viajeros, lugares, gastos o checklist de un viaje por su id. Úsalo solo si el usuario lo pide; operación atómica.", inputSchema: obj({ trip_id: str, ...ids }, ["trip_id"]), annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true } },
  { name: "add_trip_items", description: "Añade ciudades, viajeros, lugares, gastos y checklist a un viaje sin reemplazar los existentes; operación atómica.", inputSchema: obj({ request_key: str, trip_id: str, ...arrays }, ["request_key", "trip_id"]), annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true } },
];
function validate(value, schema, path = "arguments") {
  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${path}: debe ser un objeto.`);
    for (const key of schema.required || []) if (value[key] === undefined || value[key] === "") throw new Error(`${path}.${key}: obligatorio.`);
    for (const key of Object.keys(value)) {
      const field = schema.properties?.[key] || (typeof schema.additionalProperties === "object" ? schema.additionalProperties : null);
      if (!field) throw new Error(`${path}.${key}: campo no admitido.`);
      validate(value[key], field, `${path}.${key}`);
    }
  } else if (schema.type === "array") {
    if (!Array.isArray(value) || value.length > (schema.maxItems || 300)) throw new Error(`${path}: lista inválida o demasiado larga.`);
    value.forEach((item, i) => validate(item, schema.items, `${path}[${i}]`));
  } else if (schema.type === "string") {
    if (typeof value !== "string" || value.length > (schema.maxLength || 5000) || (schema.minLength && value.length < schema.minLength) || (schema.enum && !schema.enum.includes(value)) || (schema.pattern && !new RegExp(schema.pattern).test(value))) throw new Error(`${path}: texto inválido.`);
  } else if (schema.type === "boolean") {
    if (typeof value !== "boolean") throw new Error(`${path}: debe ser booleano.`);
  } else if (typeof value !== "number" || !Number.isFinite(value) || (schema.type === "integer" && !Number.isInteger(value)) || (schema.minimum !== undefined && value < schema.minimum)) throw new Error(`${path}: número inválido.`);
}
function date(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error("Fecha inválida: usa YYYY-MM-DD.");
  return value + " 12:00:00.000Z";
}
function coords(data) {
  if ((data.lat === undefined) !== (data.lng === undefined)) throw new Error("Indica lat y lng juntos.");
  if (data.lat !== undefined && (Math.abs(data.lat) > 90 || Math.abs(data.lng) > 180)) throw new Error("Coordenadas fuera de rango.");
}
function fields(data) {
  const result = { ...data };
  coords(result);
  for (const key of ["start_date", "end_date", "date"]) if (result[key]) result[key] = date(result[key]);
  return result;
}
function create(app, collection, data) {
  const record = new Record(app.findCollectionByNameOrId(collection));
  for (const key of Object.keys(data)) record.set(key, data[key]);
  app.save(record);
  return record;
}
function rows(app, collection, trip, sort = "created,id") { return app.findRecordsByFilter(collection, "trip={:trip}", sort, 0, 0, { trip }).map(r => r.publicExport()); }
function getTrip(app, id) {
  return { trip: app.findRecordById("trips", id).publicExport(), stops: rows(app, "stops", id, "position,created,id"), travelers: rows(app, "travelers", id), places: rows(app, "places", id, "day,position,created,id"), expenses: rows(app, "expenses", id), checklist: rows(app, "checklist_items", id) };
}
function reference(list, idx) {
  if (!Number.isInteger(idx) || !list[idx]) throw new Error(`Índice de relación inválido: ${idx}. Consulta get_trip.`);
  return list[idx].id;
}
function recalc(app, trip) {
  const stops = rows(app, "stops", trip.id, "position,created,id");
  if (stops.length && trip.getString("start_date")) {
    const nights = stops.reduce((sum, s) => sum + s.nights, 0);
    const start = new Date(trip.getString("start_date"));
    start.setUTCDate(start.getUTCDate() + nights);
    trip.set("end_date", start.toISOString());
    trip.set("lat", stops[0].lat); trip.set("lng", stops[0].lng);
    app.save(trip);
  }
}
function addItems(app, trip, args) {
  const stops = rows(app, "stops", trip.id, "position,created,id");
  const travelers = rows(app, "travelers", trip.id);
  let position = stops.reduce((max, s) => Math.max(max, s.position + 1), 0);
  for (const data of args.stops || []) stops.push(create(app, "stops", { ...fields(data), trip: trip.id, position: position++ }).publicExport());
  for (const data of args.travelers || []) travelers.push(create(app, "travelers", { color: "#6366f1", ...data, trip: trip.id }).publicExport());
  const counters = {};
  for (const p of rows(app, "places", trip.id)) counters[p.day] = Math.max(counters[p.day] || 0, p.position + 1);
  for (const data of args.places || []) {
    const p = fields(data); if (p.stop_index !== undefined) p.stop = reference(stops, p.stop_index); delete p.stop_index;
    p.position = counters[p.day] || 0; counters[p.day] = p.position + 1;
    create(app, "places", { ...p, trip: trip.id });
  }
  for (const data of args.expenses || []) {
    const p = fields(data); if (p.stop_index !== undefined) p.stop = reference(stops, p.stop_index); delete p.stop_index;
    if (p.paid_by_index !== undefined) p.paid_by = reference(travelers, p.paid_by_index); delete p.paid_by_index;
    if (p.split_indices) p.split = p.split_indices.map(i => reference(travelers, i)); delete p.split_indices;
    create(app, "expenses", { status: "planeado", ...p, trip: trip.id });
  }
  for (const data of args.checklist || []) {
    const p = { ...data }; if (p.assignee_indices) p.assignees = p.assignee_indices.map(i => reference(travelers, i)); delete p.assignee_indices;
    create(app, "checklist_items", { ...p, trip: trip.id });
  }
  recalc(app, trip);
}
function own(app, key, id, trip) {
  const record = app.findRecordById(COLLECTIONS[key], id);
  if (record.getString("trip") !== trip.id) throw new Error(`${key}: el id ${id} no pertenece a este viaje.`);
  return record;
}
function editItems(app, trip, args) {
  const stops = rows(app, "stops", trip.id, "position,created,id");
  const travelers = rows(app, "travelers", trip.id);
  for (const key of Object.keys(COLLECTIONS)) for (const data of args[key] || []) {
    const record = own(app, key, data.id, trip);
    const p = fields(data); delete p.id;
    if (p.stop_index !== undefined) p.stop = reference(stops, p.stop_index); delete p.stop_index;
    if (p.paid_by_index !== undefined) p.paid_by = reference(travelers, p.paid_by_index); delete p.paid_by_index;
    if (p.split_indices) p.split = p.split_indices.map(i => reference(travelers, i)); delete p.split_indices;
    if (p.assignee_indices) p.assignees = p.assignee_indices.map(i => reference(travelers, i)); delete p.assignee_indices;
    // Un lugar que cambia de día pasa al final de ese día.
    if (key === "places" && p.day !== undefined && p.day !== record.getInt("day")) p.position = rows(app, "places", trip.id).filter(x => x.day === p.day).reduce((max, x) => Math.max(max, x.position + 1), 0);
    for (const [field, value] of Object.entries(p)) record.set(field, value);
    app.save(record);
  }
  recalc(app, trip);
}
function deleteItems(app, trip, args) {
  for (const key of Object.keys(COLLECTIONS)) for (const id of args[key] || []) app.delete(own(app, key, id, trip));
  recalc(app, trip);
}
function search(app, args) {
  coords(args);
  const g = require(`${__hooks}/google.js`);
  const key = $os.getenv("GOOGLE_PLACES_SERVER_KEY");
  if (key && g.reserve(app, "places", g.limit("GOOGLE_PLACES_MONTHLY_LIMIT", 4000))) {
    try {
      const body = { textQuery: args.query, languageCode: "es", pageSize: 6 };
      if (args.lat !== undefined) body.locationBias = { circle: { center: { latitude: args.lat, longitude: args.lng }, radius: 50000 } };
      const res = $http.send({ url: "https://places.googleapis.com/v1/places:searchText", method: "POST", timeout: 10,
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location" }, body: JSON.stringify(body) });
      if (res.statusCode === 200) return (res.json.places || []).filter(p => p.location).map(p => ({ name: p.displayName?.text || p.formattedAddress, address: p.formattedAddress || "", lat: p.location.latitude, lng: p.location.longitude, geo_provider: "google", google_place_id: p.id || "" }));
    } catch (_) {}
  }
  throw new Error("Búsqueda de Google no disponible o cuota agotada. Usa coordenadas verificadas por otra fuente o deja las coordenadas vacías.");
}

function call(app, user, name, args) {
  const tool = TOOLS.find(t => t.name === name);
  if (!tool) throw new Error("Herramienta desconocida.");
  validate(args, tool.inputSchema);
  if (name === "search_locations") return search(app, args);
  if (name === "get_context") return { ...CONTEXT, schemas: { trip: tripSchema, ...itemSchemas } };
  if (name === "list_trips") return app.findRecordsByFilter("trips", "", "-created,id", 100, 0).map(r => r.publicExport());
  if (name === "get_trip") return getTrip(app, args.trip_id);
  let result;
  app.runInTransaction(tx => {
    if (args.request_key) {
      if (!/^[a-zA-Z0-9_.:-]{8,120}$/.test(args.request_key)) throw new Error("request_key: usa entre 8 y 120 letras, números o . _ : -");
      const old = arrayOf(new DynamicModel({ result: "" }));
      tx.db().newQuery("SELECT result FROM vacaciones_mcp_requests WHERE user_id={:user} AND request_key={:key}").bind({ user, key: args.request_key }).all(old);
      if (old.length) { result = JSON.parse(old[0].result); return; }
    }
    const trip = name === "create_trip" ? create(tx, "trips", { cover: "mar", budget: 0, ...fields(args.trip) }) : tx.findRecordById("trips", args.trip_id);
    if (name === "update_trip") {
      for (const [key, value] of Object.entries(fields(args.trip))) trip.set(key, value);
      tx.save(trip); recalc(tx, trip);
    } else if (name === "update_trip_items") editItems(tx, trip, args);
    else if (name === "delete_trip_items") deleteItems(tx, trip, args);
    else addItems(tx, trip, args);
    result = getTrip(tx, trip.id);
    if (args.request_key) tx.db().newQuery("INSERT INTO vacaciones_mcp_requests (user_id,request_key,result) VALUES ({:user},{:key},{:result})").bind({ user, key: args.request_key, result: JSON.stringify(result) }).execute();
  });
  return result;
}
function token(app, user, renew = false) {
  let value;
  app.runInTransaction(tx => {
    const rows = arrayOf(new DynamicModel({ token: "" }));
    tx.db().newQuery("SELECT token FROM vacaciones_mcp_tokens WHERE user_id={:user}").bind({ user }).all(rows);
    value = rows.length && !renew ? rows[0].token : "vac_mcp_" + $security.randomString(48);
    tx.db().newQuery("INSERT INTO vacaciones_mcp_tokens(user_id,token) VALUES ({:user},{:token}) ON CONFLICT(user_id) DO UPDATE SET token=excluded.token").bind({ user, token: value }).execute();
  });
  return value;
}
function settings(app, user, enabled) {
  const value = token(app, user);
  if (enabled !== undefined) app.db().newQuery("UPDATE vacaciones_mcp_tokens SET enabled={:enabled} WHERE user_id={:user}").bind({ enabled: enabled ? 1 : 0, user }).execute();
  const row = new DynamicModel({ enabled: 0 });
  app.db().newQuery("SELECT enabled FROM vacaciones_mcp_tokens WHERE user_id={:user}").bind({ user }).one(row);
  return { token: value, enabled: row.enabled === 1, path: "/api/vacaciones/mcp" };
}

function auth(e) {
  const bearer = e.request.header.get("Authorization") || "";
  if (!bearer.startsWith("Bearer vac_mcp_")) throw new UnauthorizedError("Token MCP requerido.");
  const rows = arrayOf(new DynamicModel({ user_id: "", enabled: 0 }));
  e.app.db().newQuery("SELECT user_id, enabled FROM vacaciones_mcp_tokens WHERE token={:token}").bind({ token: bearer.slice(7) }).all(rows);
  if (!rows.length) throw new UnauthorizedError("Token MCP inválido.");
  if (rows[0].enabled !== 1) throw new ForbiddenError("El MCP está desactivado. Actívalo en Agente IA, en la barra superior de la aplicación.");
  // Una cuenta eliminada deja de autorizar el token aunque permanezca la fila privada.
  try { e.app.findRecordById("users", rows[0].user_id); } catch (_) { throw new UnauthorizedError("La cuenta del token ya no existe."); }
  const origin = e.request.header.get("Origin");
  if (origin) {
    const allowed = ($os.getenv("MCP_ALLOWED_ORIGINS") || "").split(",").map(x => x.trim()).filter(Boolean);
    if (!allowed.includes(origin)) throw new ForbiddenError("Origen MCP no permitido.");
  }
  return rows[0].user_id;
}
module.exports = { CONTEXT, TOOLS, call, token, settings, auth };
