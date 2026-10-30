/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const travelers = app.findCollectionByNameOrId("travelers");
    travelers.fields.add(new TextField({ name: "avatar_variant", max: 20 }));
    app.save(travelers);
  },
  (app) => {
    const travelers = app.findCollectionByNameOrId("travelers");
    travelers.fields.removeByName("avatar_variant");
    app.save(travelers);
  },
);
