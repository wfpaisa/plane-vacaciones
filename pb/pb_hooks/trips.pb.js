/// <reference path="../pb_data/types.d.ts" />
routerAdd("POST", "/api/vacaciones/trips/{id}/duplicate", (e) => {
  const name = e.requestInfo().body.name;
  if (typeof name !== "string" || !name.trim() || name.trim().length > 120) {
    throw new BadRequestError("Escribe un nombre de hasta 120 caracteres.");
  }
  const sourceId = e.request.pathValue("id");
  let result;
  const fs = e.app.newFilesystem();
  try {
    e.app.runInTransaction((app) => {
      const source = app.findRecordById("trips", sourceId);
      function clone(record, overrides) {
        const data = record.publicExport();
        for (const key of ["id", "created", "updated", "collectionId", "collectionName", "expand"]) delete data[key];
        const copy = new Record(record.collection());
        for (const key in data) copy.set(key, data[key]);
        for (const key in overrides) copy.set(key, overrides[key]);
        app.save(copy);
        return copy;
      }
      const trip = clone(source, { name: name.trim() });
      const travelers = {}, stops = {};
      const rows = (collection) => app.findRecordsByFilter(collection, "trip={:trip}", "created,id", 0, 0, { trip: sourceId });
      for (const traveler of rows("travelers")) {
        const portrait = traveler.getString("portrait");
        const copy = clone(traveler, {
          trip: trip.id,
          portrait: portrait ? fs.getReuploadableFile(traveler.baseFilesPath() + "/" + portrait, false) : "",
        });
        travelers[traveler.id] = copy.id;
      }
      for (const stop of rows("stops")) stops[stop.id] = clone(stop, { trip: trip.id }).id;
      const travelerId = (id) => travelers[id] || "";
      const travelerIds = (record, field) => record.getStringSlice(field).map(travelerId).filter(Boolean);
      for (const place of rows("places")) clone(place, { trip: trip.id, stop: stops[place.getString("stop")] || "" });
      for (const expense of rows("expenses")) clone(expense, {
        trip: trip.id, stop: stops[expense.getString("stop")] || "",
        paid_by: travelerId(expense.getString("paid_by")), split: travelerIds(expense, "split"),
      });
      for (const item of rows("checklist_items")) clone(item, {
        trip: trip.id, assignees: travelerIds(item, "assignees"), checked_by: travelerIds(item, "checked_by"),
      });
      result = trip.publicExport();
    });
  } finally {
    fs.close();
  }
  return e.json(201, result);
}, $apis.requireAuth("users"));
