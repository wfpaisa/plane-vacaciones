/// <reference path="../pb_data/types.d.ts" />
/**
 * Un viaje puede tener varias paradas (Madrid → París → Roma). Cada parada
 * dura unas noches y se llega a ella en algún medio de transporte. Los lugares
 * y los gastos pueden quedar asociados a una parada.
 */
const FAMILIA = '@request.auth.id != ""';

migrate(
  (app) => {
    const trips = app.findCollectionByNameOrId("trips");

    const stops = new Collection({
      type: "base",
      name: "stops",
      listRule: FAMILIA,
      viewRule: FAMILIA,
      createRule: FAMILIA,
      updateRule: FAMILIA,
      deleteRule: FAMILIA,
      fields: [
        { type: "relation", name: "trip", required: true, collectionId: trips.id, cascadeDelete: true, maxSelect: 1 },
        { type: "text", name: "name", required: true, max: 120 },
        { type: "text", name: "address", max: 400 },
        { type: "text", name: "country", max: 80 },
        { type: "number", name: "lat" },
        { type: "number", name: "lng" },
        { type: "number", name: "nights", min: 0, onlyInt: true },
        { type: "number", name: "position", onlyInt: true },
        {
          type: "select",
          name: "transport",
          maxSelect: 1,
          values: ["avion", "tren", "bus", "carro", "barco", "otro"],
        },
        { type: "text", name: "notes", max: 2000 },
        { type: "autodate", name: "created", onCreate: true, onUpdate: false },
        { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
      ],
    });
    app.save(stops);

    for (const name of ["places", "expenses"]) {
      const col = app.findCollectionByNameOrId(name);
      col.fields.add(
        new RelationField({ name: "stop", collectionId: stops.id, cascadeDelete: false, maxSelect: 1 }),
      );
      app.save(col);
    }
  },
  (app) => {
    for (const name of ["places", "expenses"]) {
      const col = app.findCollectionByNameOrId(name);
      col.fields.removeByName("stop");
      app.save(col);
    }
    app.delete(app.findCollectionByNameOrId("stops"));
  },
);
