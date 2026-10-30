/// <reference path="../pb_data/types.d.ts" />
// Permite identificar los datos de Google en una revisión posterior.
migrate((app) => {
  for (const name of ["places", "stops"]) {
    const collection = app.findCollectionByNameOrId(name);
    collection.fields.add(new TextField({ name: "geo_provider", max: 40 }));
    collection.fields.add(new TextField({ name: "google_place_id", max: 300 }));
    app.save(collection);
  }
}, (app) => {
  for (const name of ["places", "stops"]) {
    const collection = app.findCollectionByNameOrId(name);
    collection.fields.removeByName("geo_provider");
    collection.fields.removeByName("google_place_id");
    app.save(collection);
  }
});
