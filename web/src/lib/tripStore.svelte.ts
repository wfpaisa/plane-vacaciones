/**
 * Todo lo de un viaje en un solo sitio: el viaje, la familia, los lugares y los
 * gastos. Se escucha en vivo, así lo que agrega uno lo ven los demás al momento.
 */
import type { RecordSubscription, UnsubscribeFunc } from "pocketbase";

import { pb } from "./pb";
import { compactMoney, formatMoney, fromInput, toDate } from "./format";
import { getExchangeRate, type ExchangeRate } from "./exchange";
import { totalNights } from "./stops";
import type { ChecklistItem, Expense, Place, Stop, Traveler, Trip, TripDocument } from "./types";

type Item = { id: string };

function apply<T extends Item>(list: T[], e: RecordSubscription<T>): T[] {
  if (e.action === "delete") return list.filter((x) => x.id !== e.record.id);
  const i = list.findIndex((x) => x.id === e.record.id);
  if (i === -1) return [...list, e.record];
  const copy = list.slice();
  copy[i] = e.record;
  return copy;
}

export class TripStore {
  id: string;
  trip = $state<Trip | null>(null);
  travelers = $state<Traveler[]>([]);
  stops = $state<Stop[]>([]);
  places = $state<Place[]>([]);
  expenses = $state<Expense[]>([]);
  checklist = $state<ChecklistItem[]>([]);
  documents = $state<TripDocument[]>([]);
  viewCurrency = $state("");
  exchange = $state<ExchangeRate | null>(null);
  rateLoading = $state(false);
  rateError = $state("");
  loading = $state(true);
  error = $state("");

  #unsubs: UnsubscribeFunc[] = [];
  #rateRequest = 0;

  constructor(id: string) {
    this.id = id;
  }

  async load() {
    this.loading = true;
    this.error = "";
    const filter = pb.filter("trip = {:id}", { id: this.id });
    try {
      const [trip, travelers, stops, places, expenses, checklist, documents] = await Promise.all([
        pb.collection("trips").getOne<Trip>(this.id),
        pb.collection("travelers").getFullList<Traveler>({ filter, sort: "created" }),
        pb.collection("stops").getFullList<Stop>({ filter, sort: "position,created" }),
        pb.collection("places").getFullList<Place>({ filter, sort: "day,position,created" }),
        pb.collection("expenses").getFullList<Expense>({ filter, sort: "-date,-created" }),
        pb.collection("checklist_items").getFullList<ChecklistItem>({ filter, sort: "created" }),
        pb.collection("documents").getFullList<TripDocument>({ filter, sort: "-created" }),
      ]);
      this.trip = trip;
      this.travelers = travelers;
      this.stops = stops;
      this.places = places;
      this.expenses = expenses;
      this.checklist = checklist;
      this.documents = documents;
      try {
        this.viewCurrency = localStorage.getItem(`vacaciones-moneda-${this.id}`) || trip.currency;
      } catch {
        this.viewCurrency = trip.currency;
      }
      void this.refreshRate();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.loading = false;
    }
    await this.#listen(filter);
  }

  async #listen(filter: string) {
    const opts = { filter };
    this.#unsubs = await Promise.all([
      pb.collection("trips").subscribe<Trip>(this.id, (e) => {
        const previous = this.trip;
        this.trip = e.action === "delete" ? null : e.record;
        if (previous?.currency !== this.trip?.currency || previous?.secondary_currency !== this.trip?.secondary_currency) void this.refreshRate();
      }),
      pb.collection("travelers").subscribe<Traveler>("*", (e) => (this.travelers = apply(this.travelers, e)), opts),
      pb.collection("stops").subscribe<Stop>("*", (e) => (this.stops = apply(this.stops, e)), opts),
      pb.collection("places").subscribe<Place>("*", (e) => (this.places = apply(this.places, e)), opts),
      pb.collection("expenses").subscribe<Expense>("*", (e) => (this.expenses = apply(this.expenses, e)), opts),
      pb.collection("checklist_items").subscribe<ChecklistItem>("*", (e) => (this.checklist = apply(this.checklist, e)), opts),
      pb.collection("documents").subscribe<TripDocument>("*", (e) => (this.documents = apply(this.documents, e)), opts),
    ]).catch(() => []);
  }

  destroy() {
    for (const off of this.#unsubs) off();
    this.#unsubs = [];
  }

  // ——— Cambios. Se aplican aquí de inmediato y PocketBase confirma después. ———

  async updateTrip(data: Partial<Trip>) {
    this.trip = await pb.collection("trips").update<Trip>(this.id, data);
    if (data.currency !== undefined || data.secondary_currency !== undefined) void this.refreshRate();
  }

  get currentCurrency() {
    const trip = this.trip;
    const primary = trip?.currency || "COP";
    return trip && this.exchange && this.exchange.base === primary && this.exchange.target === trip.secondary_currency && this.viewCurrency === trip.secondary_currency
      ? trip.secondary_currency
      : primary;
  }

  money(amount: number) {
    const converted = this.currentCurrency === this.trip?.secondary_currency;
    return `${converted ? "≈ " : ""}${formatMoney(converted ? amount * (this.exchange?.rate ?? 1) : amount, this.currentCurrency)}`;
  }

  compactMoney(amount: number) {
    const converted = this.currentCurrency === this.trip?.secondary_currency;
    return `${converted ? "≈ " : ""}${compactMoney(converted ? amount * (this.exchange?.rate ?? 1) : amount, this.currentCurrency)}`;
  }

  chooseCurrency(currency: string) {
    if (currency !== (this.trip?.currency || "COP") && (currency !== this.trip?.secondary_currency || !this.exchange)) return;
    this.viewCurrency = currency;
    try {
      localStorage.setItem(`vacaciones-moneda-${this.id}`, currency);
    } catch {}
  }

  async refreshRate() {
    const trip = this.trip;
    const request = ++this.#rateRequest;
    this.exchange = null;
    this.rateError = "";
    if (!trip?.secondary_currency || trip.secondary_currency === trip.currency) {
      this.rateLoading = false;
      this.viewCurrency = trip?.currency || "COP";
      return;
    }
    this.rateLoading = true;
    try {
      const rate = await getExchangeRate(trip.currency || "COP", trip.secondary_currency);
      if (request === this.#rateRequest) this.exchange = rate;
    } catch (err) {
      if (request === this.#rateRequest) this.rateError = err instanceof Error ? err.message : "No se pudo consultar la tasa de cambio.";
    } finally {
      if (request === this.#rateRequest) this.rateLoading = false;
    }
  }

  async saveChecklist(data: Partial<ChecklistItem>, id?: string) {
    const col = pb.collection("checklist_items");
    const rec = id ? await col.update<ChecklistItem>(id, data) : await col.create<ChecklistItem>({ ...data, trip: this.id });
    this.checklist = apply(this.checklist, { action: id ? "update" : "create", record: rec });
    return rec;
  }

  async checkForTraveler(id: string, travelerId: string, checked: boolean) {
    const rec = await pb.collection("checklist_items").update<ChecklistItem>(id, { [checked ? "checked_by+" : "checked_by-"]: travelerId });
    this.checklist = apply(this.checklist, { action: "update", record: rec });
  }

  async deleteChecklist(id: string) {
    await pb.collection("checklist_items").delete(id);
    this.checklist = this.checklist.filter((item) => item.id !== id);
  }

  async savePlace(data: Partial<Place>, id?: string) {
    const col = pb.collection("places");
    const rec = id ? await col.update<Place>(id, data) : await col.create<Place>({ ...data, trip: this.id });
    this.places = apply(this.places, { action: id ? "update" : "create", record: rec });
    return rec;
  }

  async deletePlace(id: string) {
    this.places = this.places.filter((p) => p.id !== id);
    await pb.collection("places").delete(id);
  }

  /** Deja los lugares de un día en el orden dado, y en ese día. */
  async reorder(day: number, ids: string[]) {
    const changes: Promise<unknown>[] = [];
    this.places = this.places.map((p) => {
      const i = ids.indexOf(p.id);
      if (i === -1 || (p.day === day && p.position === i)) return p;
      changes.push(pb.collection("places").update(p.id, { day, position: i }));
      return { ...p, day, position: i };
    });
    await Promise.all(changes);
  }

  async saveExpense(data: Partial<Expense>, id?: string) {
    const col = pb.collection("expenses");
    const rec = id ? await col.update<Expense>(id, data) : await col.create<Expense>({ ...data, trip: this.id });
    this.expenses = apply(this.expenses, { action: id ? "update" : "create", record: rec });
    return rec;
  }

  async deleteExpense(id: string) {
    this.expenses = this.expenses.filter((e) => e.id !== id);
    await pb.collection("expenses").delete(id);
  }

  async saveStop(data: Partial<Stop>, id?: string) {
    const col = pb.collection("stops");
    const rec = id ? await col.update<Stop>(id, data) : await col.create<Stop>({ ...data, trip: this.id });
    this.stops = apply(this.stops, { action: id ? "update" : "create", record: rec });
    await this.syncEndDate();
    return rec;
  }

  async deleteStop(id: string) {
    this.stops = this.stops.filter((s) => s.id !== id);
    await pb.collection("stops").delete(id);
    await this.syncEndDate();
  }

  async reorderStops(ids: string[]) {
    const changes: Promise<unknown>[] = [];
    this.stops = this.stops.map((s) => {
      const i = ids.indexOf(s.id);
      if (i === -1 || s.position === i) return s;
      changes.push(pb.collection("stops").update(s.id, { position: i }));
      return { ...s, position: i };
    });
    await Promise.all(changes);
  }

  /** Con paradas, el regreso es la ida más la suma de las noches. */
  async syncEndDate() {
    const start = toDate(this.trip?.start_date);
    const nights = totalNights(this.stops);
    if (!this.trip || !start || !nights) return;
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + nights);
    const value = fromInput(
      `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`,
    );
    if (this.trip.end_date.slice(0, 10) !== value.slice(0, 10)) await this.updateTrip({ end_date: value });
  }

  async saveTraveler(data: Omit<Partial<Traveler>, "portrait"> & { portrait?: File | string }, id?: string) {
    const col = pb.collection("travelers");
    const rec = id ? await col.update<Traveler>(id, data) : await col.create<Traveler>({ ...data, trip: this.id });
    this.travelers = apply(this.travelers, { action: id ? "update" : "create", record: rec });
    return rec;
  }

  async saveDocument(data: Omit<Partial<TripDocument>, "file"> & { file?: File }, id?: string) {
    const col = pb.collection("documents");
    const rec = id ? await col.update<TripDocument>(id, data) : await col.create<TripDocument>({ ...data, trip: this.id });
    this.documents = apply(this.documents, { action: id ? "update" : "create", record: rec });
    return rec;
  }

  async deleteDocument(id: string) {
    await pb.collection("documents").delete(id);
    this.documents = this.documents.filter((d) => d.id !== id);
  }

  /** Enlace temporal a un archivo protegido: el token de archivo dura unos minutos. */
  async documentUrl(doc: TripDocument, download = false) {
    const token = await pb.files.getToken();
    return pb.files.getURL(doc, doc.file, { token, ...(download ? { download: true } : {}) });
  }

  async deleteTraveler(id: string) {
    this.travelers = this.travelers.filter((t) => t.id !== id);
    await pb.collection("travelers").delete(id);
    // PocketBase vacía la relación: sus documentos pasan a ser del grupo.
    this.documents = this.documents.map((d) => (d.traveler === id ? { ...d, traveler: "" } : d));
  }
}
