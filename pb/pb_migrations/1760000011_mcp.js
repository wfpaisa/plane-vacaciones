/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  app.db().newQuery("CREATE TABLE vacaciones_mcp_tokens (user_id TEXT PRIMARY KEY, token TEXT NOT NULL UNIQUE)").execute();
  app.db().newQuery("CREATE TABLE vacaciones_mcp_requests (user_id TEXT NOT NULL, request_key TEXT NOT NULL, result TEXT NOT NULL, PRIMARY KEY(user_id, request_key))").execute();
}, (app) => {
  app.db().newQuery("DROP TABLE vacaciones_mcp_requests").execute();
  app.db().newQuery("DROP TABLE vacaciones_mcp_tokens").execute();
});
