/// <reference path="../pb_data/types.d.ts" />
routerAdd("POST", "/api/vacaciones/google/map", (e) => {
  const g = require(`${__hooks}/google.js`);
  e.response.header().set("Cache-Control", "no-store");
  const key = $os.getenv("GOOGLE_MAPS_BROWSER_KEY");
  const limit = g.limit("GOOGLE_MAPS_MONTHLY_LIMIT", 8000);
  if (!key || !g.reserve(e.app, "maps", limit)) return e.json(200, { provider: "current" });
  return e.json(200, { provider: "google", key });
}, $apis.requireAuth());

routerAdd("GET", "/api/vacaciones/google/usage", (e) => {
  const g = require(`${__hooks}/google.js`);
  e.response.header().set("Cache-Control", "no-store");
  return e.json(200, {
    month: g.month(),
    maps: { used: g.used(e.app, "maps"), limit: g.limit("GOOGLE_MAPS_MONTHLY_LIMIT", 8000) },
    places: { used: g.used(e.app, "places"), limit: g.limit("GOOGLE_PLACES_MONTHLY_LIMIT", 4000) },
  });
}, $apis.requireAuth());

routerAdd("GET", "/api/vacaciones/google/search", (e) => {
  const g = require(`${__hooks}/google.js`);
  e.response.header().set("Cache-Control", "no-store");
  const query = e.request.url.query();
  const text = (query.get("q") || "").trim();
  if (text.length < 3 || text.length > 300) throw new BadRequestError("Escribe entre 3 y 300 caracteres.");
  const key = $os.getenv("GOOGLE_PLACES_SERVER_KEY");
  const limit = g.limit("GOOGLE_PLACES_MONTHLY_LIMIT", 4000);
  if (!key || !g.reserve(e.app, "places", limit)) return e.json(200, { provider: "current" });
  const body = { textQuery: text, languageCode: "es", pageSize: 6 };
  const lat = Number(query.get("lat"));
  const lng = Number(query.get("lng"));
  if (query.get("lat") && query.get("lng") && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    body.locationBias = { circle: { center: { latitude: lat, longitude: lng }, radius: 50000 } };
  }
  try {
    const res = $http.send({
      url: "https://places.googleapis.com/v1/places:searchText", method: "POST", timeout: 10,
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType" },
      body: JSON.stringify(body),
    });
    if (res.statusCode !== 200) {
      e.app.logger().warn("Places no disponible; se usará el buscador actual", "status", res.statusCode);
      return e.json(200, { provider: "current", reason: "unavailable" });
    }
    const results = (res.json.places || []).filter((p) => p.location).map((p) => ({
      name: p.displayName ? p.displayName.text : p.formattedAddress || text,
      address: p.formattedAddress || "", lat: p.location.latitude, lng: p.location.longitude,
      kind: p.primaryType || "", provider: "google", placeId: p.id || "",
    }));
    return e.json(200, { provider: "google", results });
  } catch (_) {
    e.app.logger().warn("Places no disponible; se usará el buscador actual");
    return e.json(200, { provider: "current", reason: "unavailable" });
  }
}, $apis.requireAuth());
