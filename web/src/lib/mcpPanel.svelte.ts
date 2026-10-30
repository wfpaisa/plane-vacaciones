import type { Trip } from "./types";

/** Panel global del agente IA. Con un viaje, el mensaje inicial se enfoca en él. */
export const mcpPanel = $state<{ open: boolean; trip: Trip | null }>({ open: false, trip: null });

export function openMcpPanel(trip: Trip | null = null) {
  mcpPanel.trip = trip;
  mcpPanel.open = true;
}
