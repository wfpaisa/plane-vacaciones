/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const travelers = app.findCollectionByNameOrId("travelers");
    travelers.fields.add(
      new FileField({
        name: "portrait",
        maxSelect: 1,
        maxSize: 2 * 1024 * 1024,
        mimeTypes: ["image/webp", "image/png"],
        thumbs: ["64x64", "320x400"],
      }),
    );
    app.save(travelers);
  },
  (app) => {
    const travelers = app.findCollectionByNameOrId("travelers");
    travelers.fields.removeByName("portrait");
    app.save(travelers);
  },
);
