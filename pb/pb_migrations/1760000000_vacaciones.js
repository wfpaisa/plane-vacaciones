/// <reference path="../pb_data/types.d.ts" />
/**
 * Las colecciones del planeador: viajes, viajeros, lugares y gastos.
 * Todo lo puede ver y tocar cualquier cuenta de la familia que haya entrado.
 */
const FAMILIA = '@request.auth.id != ""';
const rules = {
  listRule: FAMILIA,
  viewRule: FAMILIA,
  createRule: FAMILIA,
  updateRule: FAMILIA,
  deleteRule: FAMILIA,
};
const dates = [
  { type: "autodate", name: "created", onCreate: true, onUpdate: false },
  { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
];

migrate(
  (app) => {
    const trips = new Collection({
      type: "base",
      name: "trips",
      ...rules,
      fields: [
        { type: "text", name: "name", required: true, max: 120 },
        { type: "text", name: "destination", max: 200 },
        { type: "number", name: "lat" },
        { type: "number", name: "lng" },
        { type: "date", name: "start_date" },
        { type: "date", name: "end_date" },
        { type: "number", name: "budget", min: 0 },
        { type: "text", name: "currency", max: 3 },
        {
          type: "select",
          name: "cover",
          maxSelect: 1,
          values: ["mar", "selva", "montana", "desierto", "ciudad", "nieve"],
        },
        { type: "json", name: "category_budgets", maxSize: 20000 },
        { type: "text", name: "notes", max: 5000 },
        ...dates,
      ],
    });
    app.save(trips);

    const tripRel = {
      type: "relation",
      name: "trip",
      required: true,
      collectionId: trips.id,
      cascadeDelete: true,
      maxSelect: 1,
    };

    const travelers = new Collection({
      type: "base",
      name: "travelers",
      ...rules,
      fields: [
        tripRel,
        { type: "text", name: "name", required: true, max: 80 },
        { type: "text", name: "emoji", max: 16 },
        { type: "text", name: "color", max: 20 },
        ...dates,
      ],
    });
    app.save(travelers);

    const places = new Collection({
      type: "base",
      name: "places",
      ...rules,
      fields: [
        tripRel,
        { type: "text", name: "name", required: true, max: 160 },
        { type: "text", name: "address", max: 400 },
        { type: "number", name: "lat" },
        { type: "number", name: "lng" },
        {
          type: "select",
          name: "category",
          maxSelect: 1,
          values: ["alojamiento", "comida", "atraccion", "naturaleza", "playa", "compras", "transporte", "otro"],
        },
        { type: "number", name: "day", min: 0, onlyInt: true },
        { type: "number", name: "position", onlyInt: true },
        { type: "text", name: "time", max: 5 },
        { type: "number", name: "cost", min: 0 },
        { type: "url", name: "link" },
        { type: "bool", name: "visited" },
        { type: "text", name: "notes", max: 2000 },
        ...dates,
      ],
    });
    app.save(places);

    const expenses = new Collection({
      type: "base",
      name: "expenses",
      ...rules,
      fields: [
        tripRel,
        { type: "text", name: "title", required: true, max: 160 },
        {
          type: "select",
          name: "category",
          maxSelect: 1,
          values: ["transporte", "alojamiento", "comida", "actividades", "compras", "otros"],
        },
        { type: "number", name: "amount", min: 0 },
        { type: "date", name: "date" },
        { type: "select", name: "status", maxSelect: 1, values: ["planeado", "pagado"] },
        {
          type: "relation",
          name: "paid_by",
          collectionId: travelers.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          type: "relation",
          name: "split",
          collectionId: travelers.id,
          cascadeDelete: false,
          maxSelect: 20,
        },
        { type: "text", name: "notes", max: 2000 },
        ...dates,
      ],
    });
    app.save(expenses);
  },
  (app) => {
    for (const name of ["expenses", "places", "travelers", "trips"]) {
      app.delete(app.findCollectionByNameOrId(name));
    }
  },
);
