/** Avisos que aparecen un momento en la esquina. */
export type ToastKind = "error" | "success" | "info";

export interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
}

let next = 1;

class Toasts {
  items = $state<ToastItem[]>([]);

  show(text: string, kind: ToastKind = "info", ms = 4500) {
    const id = next++;
    this.items.push({ id, kind, text });
    setTimeout(() => this.dismiss(id), ms);
  }

  dismiss(id: number) {
    this.items = this.items.filter((t) => t.id !== id);
  }
}

export const toasts = new Toasts();
export const toast = {
  ok: (text: string) => toasts.show(text, "success"),
  error: (text: string) => toasts.show(text, "error", 7000),
  info: (text: string) => toasts.show(text, "info"),
};
