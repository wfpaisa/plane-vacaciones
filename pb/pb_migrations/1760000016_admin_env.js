/// <reference path="../pb_data/types.d.ts" />
/**
 * Aplica ADMIN_USER y ADMIN_PASSWORD de `.env` a la cuenta admin (la más
 * antigua marcada como admin): cambia su usuario y su contraseña si no
 * coinciden y cierra sus sesiones. Corre una sola vez; después la contraseña
 * se cambia desde la app.
 */
migrate((app) => {
  const user = $os.getenv("ADMIN_USER").trim().toLowerCase();
  const password = $os.getenv("ADMIN_PASSWORD");
  if (!user || !password) return;
  const username = user.includes("@") ? user.split("@")[0] : user;
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw new Error("ADMIN_USER debe tener de 3 a 30 letras minúsculas, números, puntos o guiones.");
  if (password.length < 10) throw new Error("ADMIN_PASSWORD debe tener al menos 10 caracteres.");

  const admins = app.findRecordsByFilter("users", "is_admin = true", "created", 1, 0);
  if (!admins.length) return;
  const admin = admins[0];

  let changed = false;
  if (admin.getString("username") !== username) {
    const taken = app.findRecordsByFilter("users", "username = {:u} && id != {:id}", "", 1, 0, { u: username, id: admin.id });
    if (taken.length) throw new Error(`ADMIN_USER «${username}» ya lo usa otra cuenta.`);
    admin.set("username", username);
    changed = true;
  }
  if (!admin.validatePassword(password)) {
    admin.setPassword(password);
    admin.refreshTokenKey();
    changed = true;
  }
  // El correo interno de la primera migración no sirve para nada fuera de ella.
  if (admin.getString("email").endsWith("@vacaciones.local")) {
    admin.set("email", "");
    changed = true;
  }
  if (changed) app.save(admin);
}, () => {});
