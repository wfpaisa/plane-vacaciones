/// <reference path="../pb_data/types.d.ts" />
/**
 * Respaldos automáticos de PocketBase: un .zip diario en pb_data/backups, a
 * las 05:00 UTC (medianoche en Bogotá), antes de que Proxmox (CT 111) los
 * recoja a la 01:30. Se guardan los últimos 7. Se pueden cambiar después en
 * la consola (/db/ → Settings → Backups).
 */
migrate((app) => {
  const settings = app.settings();
  if (settings.backups.cron) return;
  settings.backups.cron = "0 5 * * *";
  settings.backups.cronMaxKeep = 7;
  app.save(settings);
}, (app) => {
  const settings = app.settings();
  settings.backups.cron = "";
  app.save(settings);
});
