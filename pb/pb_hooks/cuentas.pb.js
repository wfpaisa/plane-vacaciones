/// <reference path="../pb_data/types.d.ts" />
// Cuentas: cualquier miembro crea cuentas; solo la administradora restablece contraseñas.
routerAdd("GET", "/api/vacaciones/accounts", (e) => {
  const c = require(`${__hooks}/cuentas.js`);
  e.response.header().set("Cache-Control", "no-store");
  return e.json(200, { me: c.account(e.auth), users: c.list(e.app) });
}, $apis.requireAuth("users"));
routerAdd("POST", "/api/vacaciones/accounts", (e) => {
  const c = require(`${__hooks}/cuentas.js`);
  return e.json(200, c.create(e.app, e.requestInfo().body));
}, $apis.requireAuth("users"));
routerAdd("POST", "/api/vacaciones/account/password", (e) => {
  const c = require(`${__hooks}/cuentas.js`);
  const record = e.app.findRecordById("users", e.auth.id);
  c.changeOwn(e.app, record, e.requestInfo().body);
  // El token anterior deja de servir: se entrega uno nuevo para seguir dentro.
  return $apis.recordAuthResponse(e, record, "password");
}, $apis.requireAuth("users"));
routerAdd("POST", "/api/vacaciones/accounts/{id}/password", (e) => {
  const c = require(`${__hooks}/cuentas.js`);
  return e.json(200, c.reset(e.app, e.auth, e.request.pathValue("id"), e.requestInfo().body));
}, $apis.requireAuth("users"));

// Enlaces de solo lectura de un viaje.
routerAdd("GET", "/api/vacaciones/trips/{id}/share", (e) => {
  const c = require(`${__hooks}/cuentas.js`);
  e.response.header().set("Cache-Control", "no-store");
  return e.json(200, { token: c.share(e.app, e.request.pathValue("id")) });
}, $apis.requireAuth("users"));
routerAdd("POST", "/api/vacaciones/trips/{id}/share", (e) => {
  const c = require(`${__hooks}/cuentas.js`);
  return e.json(200, { token: c.createShare(e.app, e.request.pathValue("id"), e.auth.id) });
}, $apis.requireAuth("users"));
routerAdd("DELETE", "/api/vacaciones/trips/{id}/share", (e) => {
  const c = require(`${__hooks}/cuentas.js`);
  c.revokeShare(e.app, e.request.pathValue("id"));
  return e.noContent(204);
}, $apis.requireAuth("users"));
routerAdd("GET", "/api/vacaciones/shared/{token}", (e) => {
  const c = require(`${__hooks}/cuentas.js`);
  e.response.header().set("Cache-Control", "no-store");
  e.response.header().set("X-Robots-Tag", "noindex");
  return e.json(200, c.shared(e.app, e.request.pathValue("token")));
});
