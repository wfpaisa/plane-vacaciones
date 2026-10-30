/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const trips = app.findCollectionByNameOrId("trips");
    const cover = trips.fields.getByName("cover");
    cover.values = [...cover.values, "menta", "rosa", "ambar", "petroleo", "lavanda", "lima"];
    app.save(trips);
  },
  (app) => {
    app.db().newQuery("UPDATE trips SET cover = 'mar' WHERE cover IN ('menta', 'rosa', 'ambar', 'petroleo', 'lavanda', 'lima')").execute();
    const trips = app.findCollectionByNameOrId("trips");
    trips.fields.getByName("cover").values = ["mar", "selva", "montana", "desierto", "ciudad", "nieve"];
    app.save(trips);
  },
);
