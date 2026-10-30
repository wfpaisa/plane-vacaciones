/**
 * Rutas con `#`: así PocketBase puede servir la web como archivos sueltos sin
 * saber nada de ellas.
 *
 *   #/                      los viajes
 *   #/viaje/<id>/<seccion>  un viaje
 *   #/compartido/<token>    un viaje en solo lectura, sin sesión
 */
export type Section = "resumen" | "ruta" | "lugares" | "gastos" | "checklist" | "familia";

export type Route = { page: "home" } | { page: "trip"; id: string; section: Section } | { page: "shared"; token: string };

const SECTIONS: Section[] = ["resumen", "ruta", "lugares", "gastos", "checklist", "familia"];

function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "viaje" && parts[1]) {
    const section = SECTIONS.includes(parts[2] as Section) ? (parts[2] as Section) : "resumen";
    return { page: "trip", id: parts[1], section };
  }
  if (parts[0] === "compartido" && parts[1]) return { page: "shared", token: parts[1] };
  return { page: "home" };
}

class Router {
  route = $state<Route>(parse(location.hash));

  constructor() {
    window.addEventListener("hashchange", () => {
      this.route = parse(location.hash);
    });
  }

  go(path: string) {
    location.hash = path;
  }
}

export const router = new Router();

export const sharedPath = (token: string) => `#/compartido/${token}`;
export const tripPath = (id: string, section: Section = "resumen") => `#/viaje/${id}/${section}`;
