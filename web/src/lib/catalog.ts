/**
 * Lo que se ve de cada categoría: nombre, icono y color. El color va en
 * oklch para que todas tengan una luz parecida y se distingan por el tono.
 */
import type { Cover, DocumentKind, ExpenseCategory, PlaceCategory, Transport } from "./types";

type Look = { label: string; icon: string; color: string };

export const PLACE_CATEGORIES: Record<PlaceCategory, Look> = {
  alojamiento: { label: "Alojamiento", icon: "bed", color: "oklch(0.6 0.24 295)" },
  comida: { label: "Comida", icon: "restaurant-01", color: "oklch(0.68 0.2 35)" },
  atraccion: { label: "Para ver", icon: "camera-01", color: "oklch(0.63 0.25 355)" },
  naturaleza: { label: "Naturaleza", icon: "mountain", color: "oklch(0.68 0.19 150)" },
  playa: { label: "Playa", icon: "beach", color: "oklch(0.7 0.15 215)" },
  compras: { label: "Compras", icon: "shopping-bag-02", color: "oklch(0.75 0.17 70)" },
  transporte: { label: "Transporte", icon: "bus-01", color: "oklch(0.6 0.2 255)" },
  otro: { label: "Otro", icon: "location-star-01", color: "oklch(0.62 0.04 255)" },
};

export const EXPENSE_CATEGORIES: Record<ExpenseCategory, Look> = {
  transporte: { label: "Transporte", icon: "airplane-01", color: "oklch(0.56 0.24 264)" },
  alojamiento: { label: "Alojamiento", icon: "bed", color: "oklch(0.64 0.23 305)" },
  comida: { label: "Comida", icon: "restaurant-01", color: "oklch(0.7 0.19 30)" },
  actividades: { label: "Actividades", icon: "ticket-01", color: "oklch(0.74 0.14 190)" },
  compras: { label: "Compras", icon: "shopping-bag-02", color: "oklch(0.8 0.16 75)" },
  otros: { label: "Otros", icon: "coins-01", color: "oklch(0.84 0.2 125)" },
};

export const DOCUMENT_KINDS: Record<DocumentKind, Look> = {
  seguro: { label: "Seguro", icon: "shield-01", color: "oklch(0.66 0.17 155)" },
  tiquete: { label: "Tiquete", icon: "airplane-01", color: "oklch(0.56 0.24 264)" },
  entrada: { label: "Entrada", icon: "ticket-01", color: "oklch(0.74 0.14 190)" },
  reserva: { label: "Reserva", icon: "bed", color: "oklch(0.64 0.23 305)" },
  identidad: { label: "Identidad", icon: "passport", color: "oklch(0.7 0.19 30)" },
  otro: { label: "Otro", icon: "file-01", color: "oklch(0.62 0.02 260)" },
};

/** El color de cada viaje: una franja sobria que lo distingue en la lista. */
export const COVERS: Record<Cover, { label: string; color: string }> = {
  mar: { label: "Azul índigo", color: "oklch(0.58 0.19 265)" },
  selva: { label: "Verde jade", color: "oklch(0.64 0.13 165)" },
  montana: { label: "Grafito", color: "oklch(0.48 0.04 255)" },
  desierto: { label: "Coral", color: "oklch(0.69 0.16 35)" },
  ciudad: { label: "Violeta", color: "oklch(0.61 0.17 300)" },
  nieve: { label: "Azul glaciar", color: "oklch(0.72 0.1 220)" },
  menta: { label: "Menta", color: "oklch(0.77 0.12 170)" },
  rosa: { label: "Rosa", color: "oklch(0.69 0.18 350)" },
  ambar: { label: "Ámbar", color: "oklch(0.77 0.15 75)" },
  petroleo: { label: "Petróleo", color: "oklch(0.49 0.08 205)" },
  lavanda: { label: "Lavanda", color: "oklch(0.76 0.12 295)" },
  lima: { label: "Lima", color: "oklch(0.79 0.16 125)" },
};

/**
 * Cada medio de transporte pinta su trayecto en el mapa con su color. Son
 * colores claros y saturados para que se lean sobre el mapa claro, el oscuro y el satélite.
 */
export const TRANSPORTS: Record<Transport, { label: string; icon: string; color: string }> = {
  avion: { label: "Avión", icon: "airplane-01", color: "oklch(0.68 0.19 250)" },
  tren: { label: "Tren", icon: "train-01", color: "oklch(0.86 0.2 128)" },
  bus: { label: "Bus", icon: "bus-01", color: "oklch(0.74 0.18 55)" },
  carro: { label: "Carro", icon: "car-01", color: "oklch(0.66 0.24 350)" },
  barco: { label: "Barco", icon: "boat", color: "oklch(0.78 0.13 200)" },
  otro: { label: "Otro", icon: "route-01", color: "oklch(0.74 0.02 250)" },
};

/** Colores de identificación de los viajeros. */
export const SWATCHES = [
  "oklch(0.64 0.17 38)",
  "oklch(0.6 0.11 215)",
  "oklch(0.58 0.12 150)",
  "oklch(0.58 0.16 350)",
  "oklch(0.55 0.13 285)",
  "oklch(0.72 0.14 75)",
  "oklch(0.55 0.1 185)",
  "oklch(0.5 0.12 260)",
];

/** Paleta de los días, compartida por el plan y el mapa. */
const DAY_COLORS = [
  "oklch(0.56 0.25 265)",
  "oklch(0.6 0.23 340)",
  "oklch(0.58 0.19 155)",
  "oklch(0.62 0.21 40)",
  "oklch(0.56 0.24 305)",
  "oklch(0.6 0.17 200)",
  "oklch(0.63 0.18 75)",
  "oklch(0.58 0.22 20)",
];

export const dayColor = (day: number) => DAY_COLORS[(day - 1 + DAY_COLORS.length) % DAY_COLORS.length];

export const CURRENCIES = ["COP", "USD", "EUR", "MXN", "ARS", "BRL", "PEN", "CLP"];
