/// <reference path="../pb_data/types.d.ts" />
/**
 * Detrás de un proxy inverso, PocketBase debe leer la IP real del visitante
 * para que los límites de peticiones no traten a todos como uno solo.
 * TRUSTED_PROXY_HEADERS (p. ej. "X-Real-IP") solo se define en producción.
 */
onBootstrap((e) => {
  e.next();
  const headers = ($os.getenv("TRUSTED_PROXY_HEADERS") || "").split(",").map((h) => h.trim()).filter(Boolean);
  if (!headers.length) return;
  const settings = e.app.settings();
  settings.trustedProxy.headers = headers;
  settings.trustedProxy.useLeftmostIP = false;
  e.app.save(settings);
});

// Cabeceras de seguridad básicas para la web y la API.
routerUse((e) => {
  const h = e.response.header();
  h.set("X-Content-Type-Options", "nosniff");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  h.set("X-Frame-Options", "SAMEORIGIN");
  h.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
  return e.next();
});
