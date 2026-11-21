import { event, signal } from "@lightstart/light/signals";

export const archived = event();
export const lastArchived = signal(null);
