/// <reference path="../pb_data/types.d.ts" />
/**
 * Varias cuentas de la familia, con nombre de usuario en vez de correo.
 * La primera cuenta es administradora y puede restablecer contraseñas.
 * Las cuentas solo se crean desde la aplicación (hooks), nunca por registro
 * público, y nadie puede editar su propio registro por la API genérica.
 * Además, enlaces de solo lectura para compartir un viaje.
 */
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.fields.add(new TextField({ name: "username", max: 30, pattern: "^[a-z0-9._-]{3,30}$" }));
    users.fields.add(new BoolField({ name: "is_admin" }));
    users.fields.getByName("email").required = false;
    users.createRule = null;
    users.updateRule = null;
    users.deleteRule = null;
    app.save(users);

    // Cada cuenta existente recibe un usuario a partir de su correo; la más antigua administra.
    const taken = new Set();
    const records = app.findRecordsByFilter("users", "", "created,id", 0, 0);
    records.forEach((record, i) => {
      const base = (record.getString("email").split("@")[0] || "familia").toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 26).padEnd(3, "0");
      let name = base;
      for (let n = 2; taken.has(name); n++) name = base + n;
      taken.add(name);
      record.set("username", name);
      if (i === 0) record.set("is_admin", true);
      app.saveNoValidate(record);
    });
    users.fields.getByName("username").required = true;
    users.addIndex("idx_users_username", true, "username", "");
    users.passwordAuth.identityFields = ["username", "email"];
    app.save(users);

    const trips = app.findCollectionByNameOrId("trips");
    const shares = new Collection({
      type: "base",
      name: "trip_shares",
      listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
      fields: [
        { type: "relation", name: "trip", required: true, collectionId: trips.id, cascadeDelete: true, maxSelect: 1 },
        { type: "text", name: "token", required: true, min: 32, max: 64 },
        { type: "relation", name: "created_by", collectionId: users.id, cascadeDelete: false, maxSelect: 1 },
        { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_trip_shares_token ON trip_shares (token)",
        "CREATE UNIQUE INDEX idx_trip_shares_trip ON trip_shares (trip)",
      ],
    });
    app.save(shares);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId("trip_shares"));
    const users = app.findCollectionByNameOrId("users");
    users.removeIndex("idx_users_username");
    users.fields.removeByName("username");
    users.fields.removeByName("is_admin");
    users.fields.getByName("email").required = true;
    users.passwordAuth.identityFields = ["email"];
    users.updateRule = "id = @request.auth.id";
    users.deleteRule = "id = @request.auth.id";
    app.save(users);
  },
);
