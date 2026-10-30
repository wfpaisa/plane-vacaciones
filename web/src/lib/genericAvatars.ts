import type { Traveler } from "./types";

export const GENERIC_AVATARS = [
  { id: "generic-1", src: "/avatars/generic-1.webp", label: "Tony Stark", group: "Adultos", gender: "man" },
  { id: "generic-2", src: "/avatars/generic-2.webp", label: "Arwen", group: "Adultos", gender: "woman" },
  { id: "generic-3", src: "/avatars/generic-3.webp", label: "Indiana Jones", group: "Adultos", gender: "man" },
  { id: "generic-4", src: "/avatars/generic-4.webp", label: "Trinity", group: "Adultos", gender: "woman" },
  { id: "generic-5", src: "/avatars/generic-5.webp", label: "Morpheus", group: "Mayores", gender: "man" },
  { id: "generic-6", src: "/avatars/generic-6.webp", label: "Shuri", group: "Adultos", gender: "woman" },
  { id: "generic-7", src: "/avatars/generic-7-v4.webp", label: "Minerva McGonagall", group: "Mayores", gender: "woman" },
  { id: "generic-8", src: "/avatars/generic-8.webp", label: "Marty McFly", group: "Adultos", gender: "man" },
  { id: "generic-9", src: "/avatars/generic-9.webp", label: "Dominic Toretto", group: "Adultos", gender: "man" },
  { id: "generic-10", src: "/avatars/generic-10.webp", label: "Lara Croft", group: "Adultos", gender: "woman" },
  { id: "generic-11", src: "/avatars/generic-11.webp", label: "Kevin McCallister", group: "Niños", gender: "man" },
  { id: "generic-12", src: "/avatars/generic-12.webp", label: "Miguel Rivera", group: "Niños", gender: "man" },
  { id: "generic-13", src: "/avatars/generic-13.webp", label: "Albus Dumbledore", group: "Mayores", gender: "man" },
  { id: "generic-14", src: "/avatars/generic-14.webp", label: "Matilda", group: "Niños", gender: "woman" },
  { id: "generic-15", src: "/avatars/generic-15.webp", label: "Boo", group: "Niños", gender: "woman" },
  { id: "generic-16", src: "/avatars/generic-16.webp", label: "T’Challa", group: "Adultos", gender: "man" },
  { id: "generic-17", src: "/avatars/generic-17.webp", label: "Harry Potter", group: "Adolescentes", gender: "man" },
  { id: "generic-18", src: "/avatars/generic-18.webp", label: "Katniss Everdeen", group: "Adolescentes", gender: "woman" },
  { id: "generic-19", src: "/avatars/generic-19.webp", label: "Ellen Ripley", group: "Adultos", gender: "woman" },
  { id: "generic-21", src: "/avatars/generic-21-v3.webp", label: "Molly Weasley", group: "Mayores", gender: "woman" },
  { id: "generic-22", src: "/avatars/generic-22.webp", label: "Peter Parker", group: "Adolescentes", gender: "man" },
  { id: "generic-23", src: "/avatars/generic-23.webp", label: "Luna Lovegood", group: "Adolescentes", gender: "woman" },
  { id: "generic-24", src: "/avatars/generic-24.webp", label: "Diana Prince", group: "Adultos", gender: "woman" },
  { id: "generic-25", src: "/avatars/generic-25.webp", label: "Okoye", group: "Adultos", gender: "woman" },
  { id: "generic-26", src: "/avatars/generic-26.webp", label: "Natasha Romanoff", group: "Adultos", gender: "woman" },
  { id: "generic-27", src: "/avatars/generic-27.webp", label: "Aragorn", group: "Adultos", gender: "man" },
  { id: "generic-28", src: "/avatars/generic-28.webp", label: "Finn", group: "Adultos", gender: "man" },
  { id: "generic-29", src: "/avatars/generic-29-v2.webp", label: "Jack Sparrow", group: "Adultos", gender: "man" },
  { id: "generic-30", src: "/avatars/generic-30-v2.webp", label: "James Bond", group: "Adultos", gender: "man" },
  { id: "generic-31", src: "/avatars/generic-31-v2.webp", label: "Elizabeth Swann", group: "Adultos", gender: "woman" },
  { id: "generic-32", src: "/avatars/generic-32-v2.webp", label: "Hermione Granger", group: "Adultos", gender: "woman" },
  { id: "generic-33", src: "/avatars/generic-33-v4.webp", label: "Barbie", group: "Adultos", gender: "woman" },
] as const;

export const AVATAR_GROUPS = ["Adultos", "Adolescentes", "Niños", "Mayores"] as const;

// El orden de la galería es independiente del catálogo que asigna los avatares por defecto.
const GALLERY_ORDER = [2, 4, 6, 32, 10, 19, 33, 24, 25, 26, 31, 1, 29, 28, 3, 8, 9, 16, 30, 27];

export function avatarsForGroup(group: typeof AVATAR_GROUPS[number]) {
  const position = (id: string) => {
    const index = GALLERY_ORDER.indexOf(Number(id.replace("generic-", "")));
    return index < 0 ? GALLERY_ORDER.length : index;
  };
  return GENERIC_AVATARS.filter(avatar => avatar.group === group).sort((a, b) =>
    Number(a.gender === "man") - Number(b.gender === "man") || position(a.id) - position(b.id),
  );
}

export function genericAvatarFor(traveler: Pick<Traveler, "id" | "avatar_variant">) {
  const chosen = GENERIC_AVATARS.find((avatar) => avatar.id === traveler.avatar_variant);
  if (chosen) return chosen;
  const hash = [...traveler.id].reduce((value, character) => Math.imul(value, 31) + character.charCodeAt(0) | 0, 0);
  return GENERIC_AVATARS[(hash >>> 0) % 8];
}
