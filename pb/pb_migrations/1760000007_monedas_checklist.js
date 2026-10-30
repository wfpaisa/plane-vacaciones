/// <reference path="../pb_data/types.d.ts" />

const FAMILIA = '@request.auth.id != ""';
const dates = [
  { type: "autodate", name: "created", onCreate: true, onUpdate: false },
  { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
];

migrate(
  (app) => {
    const trips = app.findCollectionByNameOrId("trips");
    const travelers = app.findCollectionByNameOrId("travelers");
    trips.fields.add(new TextField({ name: "secondary_currency", max: 3 }));
    app.save(trips);

    const items = new Collection({
      type: "base",
      name: "checklist_items",
      listRule: FAMILIA,
      viewRule: FAMILIA,
      createRule: FAMILIA,
      updateRule: FAMILIA,
      deleteRule: FAMILIA,
      fields: [
        { type: "relation", name: "trip", required: true, collectionId: trips.id, cascadeDelete: true, maxSelect: 1 },
        { type: "text", name: "title", required: true, max: 180 },
        { type: "select", name: "kind", required: true, maxSelect: 1, values: ["group", "individual"] },
        { type: "bool", name: "done" },
        { type: "bool", name: "assign_all" },
        { type: "relation", name: "assignees", collectionId: travelers.id, cascadeDelete: false, maxSelect: 99 },
        { type: "relation", name: "checked_by", collectionId: travelers.id, cascadeDelete: false, maxSelect: 99 },
        ...dates,
      ],
    });
    app.save(items);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId("checklist_items"));
    const trips = app.findCollectionByNameOrId("trips");
    trips.fields.removeByName("secondary_currency");
    app.save(trips);
  },
);
