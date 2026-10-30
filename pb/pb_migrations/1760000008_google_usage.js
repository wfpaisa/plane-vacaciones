/// <reference path="../pb_data/types.d.ts" />
// Contadores privados, compartidos por todas las cuentas y persistentes al reiniciar.
migrate((app) => {
  app.db().newQuery(`CREATE TABLE google_usage (
    month TEXT NOT NULL, service TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (month, service)
  )`).execute();
}, (app) => {
  app.db().newQuery("DROP TABLE IF EXISTS google_usage").execute();
});
