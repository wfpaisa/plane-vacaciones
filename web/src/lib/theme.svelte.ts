/** Claro u oscuro. Lo elegido se recuerda; si no, manda el sistema. */
const KEY = "vacaciones-tema";

class Theme {
  dark = $state(document.documentElement.dataset.theme === "dark");

  toggle() {
    this.dark = !this.dark;
    document.documentElement.dataset.theme = this.dark ? "dark" : "light";
    try {
      localStorage.setItem(KEY, this.dark ? "dark" : "light");
    } catch {}
  }
}

export const theme = new Theme();
