/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const travelers = app.findCollectionByNameOrId("travelers");
    const portrait = travelers.fields.getByName("portrait");
    portrait.maxSize = 10 * 1024 * 1024;
    portrait.mimeTypes = ["image/jpeg", "image/png", "image/webp"];
    app.save(travelers);
  },
  (app) => {
    const travelers = app.findCollectionByNameOrId("travelers");
    const portrait = travelers.fields.getByName("portrait");
    portrait.maxSize = 2 * 1024 * 1024;
    portrait.mimeTypes = ["image/webp", "image/png"];
    app.save(travelers);
  },
);
