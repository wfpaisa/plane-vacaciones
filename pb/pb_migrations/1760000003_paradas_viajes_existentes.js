/// <reference path="../pb_data/types.d.ts" />
/**
 * Los viajes creados antes de las paradas tenían un solo destino. Se convierten
 * en un recorrido de una parada, con las noches que dura el viaje.
 */
migrate((app) => {
  const stops = app.findCollectionByNameOrId("stops");
  for (const trip of app.findAllRecords("trips")) {
    if (!trip.getFloat("lat") && !trip.getFloat("lng")) continue;
    if (app.findRecordsByFilter("stops", "trip = {:id}", "", 1, 0, { id: trip.id }).length) continue;
    const start = trip.getDateTime("start_date");
    const end = trip.getDateTime("end_date");
    const nights =
      start.isZero() || end.isZero() ? 0 : Math.max(0, Math.round((end.unix() - start.unix()) / 86400));
    const stop = new Record(stops);
    stop.set("trip", trip.id);
    stop.set("name", (trip.getString("destination") || trip.getString("name")).split(",")[0].trim());
    stop.set("address", trip.getString("destination"));
    stop.set("lat", trip.getFloat("lat"));
    stop.set("lng", trip.getFloat("lng"));
    stop.set("nights", nights);
    stop.set("position", 0);
    stop.set("transport", "avion");
    app.save(stop);
  }
});
