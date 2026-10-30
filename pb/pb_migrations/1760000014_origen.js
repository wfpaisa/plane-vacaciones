/// <reference path="../pb_data/types.d.ts" />
/**
 * Ciudad de origen del viaje: desde dónde sale la familia. Sirve para
 * planear el trayecto de ida al primer destino y el regreso.
 */
migrate(
  (app) => {
    const trips = app.findCollectionByNameOrId("trips");
    trips.fields.add(new TextField({ name: "origin", max: 200 }));
    app.save(trips);
  },
  (app) => {
    const trips = app.findCollectionByNameOrId("trips");
    trips.fields.removeByName("origin");
    app.save(trips);
  },
);
