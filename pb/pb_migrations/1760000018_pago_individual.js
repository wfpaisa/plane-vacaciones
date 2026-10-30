/// <reference path="../pb_data/types.d.ts" />
/**
 * Gasto pagado individualmente: cada viajero que lo comparte pagó su parte
 * por aparte, así que no le debe nada a nadie (sin `paid_by`).
 */
migrate(
  (app) => {
    const expenses = app.findCollectionByNameOrId("expenses");
    expenses.fields.add(new BoolField({ name: "paid_individually" }));
    app.save(expenses);
  },
  (app) => {
    const expenses = app.findCollectionByNameOrId("expenses");
    expenses.fields.removeByName("paid_individually");
    app.save(expenses);
  },
);
