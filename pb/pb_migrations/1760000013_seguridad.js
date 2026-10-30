/// <reference path="../pb_data/types.d.ts" />
/**
 * Solo entra la familia: se cierra el registro público de cuentas (antes
 * cualquiera podía crear una y ver todos los viajes) y se activan los límites
 * de peticiones de PocketBase contra fuerza bruta en el inicio de sesión.
 */
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.createRule = null;
    app.save(users);

    const settings = app.settings();
    settings.rateLimits.enabled = true;
    app.save(settings);
  },
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    users.createRule = "";
    app.save(users);
  },
);
