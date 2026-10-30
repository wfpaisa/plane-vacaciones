/**
 * Contraseñas sugeridas fáciles de dictar: cuatro sílabas dobles y un número,
 * por ejemplo «tamo-reli-supa-47». Unos 52 bits de azar del navegador.
 */
const CONSONANTS = "bcdfgjklmnprstvz";
const VOWELS = "aeiou";

function pick(set: string, n: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(bytes, (b) => set[b % set.length]).join("");
}

export function suggestPassword() {
  const word = () => {
    const c = pick(CONSONANTS, 2), v = pick(VOWELS, 2);
    return c[0] + v[0] + c[1] + v[1];
  };
  const digits = String(10 + (crypto.getRandomValues(new Uint8Array(1))[0] % 90));
  return [word(), word(), word(), digits].join("-");
}
