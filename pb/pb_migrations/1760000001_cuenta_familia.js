/// <reference path="../pb_data/types.d.ts" />
/**
 * La primera cuenta, tomada de `.env` (ADMIN_USER y ADMIN_PASSWORD). Si ya
 * existe, no se toca. En este punto la colección todavía pide correo: si
 * ADMIN_USER es solo un usuario, se guarda un correo interno con ese nombre y
 * la migración de cuentas lo convierte en el usuario con el que se entra.
 */
migrate((app) => {
  const user = $os.getenv("ADMIN_USER").trim().toLowerCase();
  const password = $os.getenv("ADMIN_PASSWORD");
  if (!user || !password) return;
  const email = user.includes("@") ? user : `${user}@vacaciones.local`;

  try {
    app.findAuthRecordByEmail("users", email);
    return;
  } catch {}

  const record = new Record(app.findCollectionByNameOrId("users"));
  record.set("email", email);
  record.set("name", "Familia");
  record.set("verified", true);
  record.setPassword(password);
  app.save(record);
});
