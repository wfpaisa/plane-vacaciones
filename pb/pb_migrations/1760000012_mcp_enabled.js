/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  app.db().newQuery("ALTER TABLE vacaciones_mcp_tokens ADD COLUMN enabled INTEGER NOT NULL DEFAULT 0").execute();
}, (app) => {
  app.db().newQuery("ALTER TABLE vacaciones_mcp_tokens DROP COLUMN enabled").execute();
});
