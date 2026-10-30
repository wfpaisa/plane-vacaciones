import type { RecordModel } from "pocketbase";

export type Cover = "mar" | "selva" | "montana" | "desierto" | "ciudad" | "nieve" | "menta" | "rosa" | "ambar" | "petroleo" | "lavanda" | "lima";

export type PlaceCategory =
  | "alojamiento"
  | "comida"
  | "atraccion"
  | "naturaleza"
  | "playa"
  | "compras"
  | "transporte"
  | "otro";

export type ExpenseCategory =
  | "transporte"
  | "alojamiento"
  | "comida"
  | "actividades"
  | "compras"
  | "otros";

export type Transport = "avion" | "tren" | "bus" | "carro" | "barco" | "otro";

export interface Trip extends RecordModel {
  name: string;
  origin?: string;
  destination: string;
  lat: number;
  lng: number;
  start_date: string;
  end_date: string;
  budget: number;
  currency: string;
  secondary_currency: string;
  cover: Cover | "";
  category_budgets: Partial<Record<ExpenseCategory, number>> | null;
  notes: string;
}

export interface Traveler extends RecordModel {
  trip: string;
  name: string;
  emoji: string;
  color: string;
  portrait: string;
  avatar_variant: string;
}

export type DocumentKind = "seguro" | "tiquete" | "entrada" | "reserva" | "identidad" | "otro";

/** Un archivo del viaje (PDF o imagen) de un viajero, o de todo el grupo si `traveler` está vacío. */
export interface TripDocument extends RecordModel {
  trip: string;
  traveler: string;
  title: string;
  kind: DocumentKind | "";
  file: string;
  notes: string;
}

/** Una parada del recorrido: una ciudad donde se pasan unas noches. */
export interface Stop extends RecordModel {
  geo_provider?: string;
  google_place_id?: string;
  trip: string;
  name: string;
  address: string;
  country: string;
  lat: number;
  lng: number;
  nights: number;
  position: number;
  /** Cómo se llega a esta parada desde la anterior. */
  transport: Transport | "";
  notes: string;
}

export interface Place extends RecordModel {
  geo_provider?: string;
  google_place_id?: string;
  trip: string;
  stop: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: PlaceCategory | "";
  /** 0 = todavía sin día: la lista de ideas. */
  day: number;
  position: number;
  time: string;
  cost: number;
  link: string;
  visited: boolean;
  notes: string;
}

export interface Expense extends RecordModel {
  trip: string;
  /** Vacío = gasto general del viaje. */
  stop: string;
  title: string;
  category: ExpenseCategory | "";
  amount: number;
  date: string;
  status: "planeado" | "pagado" | "";
  paid_by: string;
  /** Cada viajero del reparto pagó su parte por aparte: nadie le debe a nadie. */
  paid_individually?: boolean;
  /** Vacío = entre todos los viajeros. */
  split: string[];
  notes: string;
}

export interface ChecklistItem extends RecordModel {
  trip: string;
  title: string;
  kind: "group" | "individual";
  done: boolean;
  assign_all: boolean;
  assignees: string[];
  checked_by: string[];
}

export interface TripDraft {
  trip: Partial<Trip>;
  travelers: { name: string; color: string }[];
  stops: Partial<Stop>[];
}
