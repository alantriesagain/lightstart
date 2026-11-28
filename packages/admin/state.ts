/**
 * @file The page state the admin shell draws: the title the session answers,
 * the notifications a tool adds, and whether the notifications panel is open.
 */

import { signal } from "@lightstart/light/signals";
import type { Signal } from "@lightstart/light/signals";

/** How a notification is marked. */
export type AdminNotificationKind = "info" | "success" | "warning" | "error";

/** One notification the admin's bell lists. */
export interface AdminNotification {
  id: string;
  title: string;
  body?: string;
  kind?: AdminNotificationKind;
  at: number;
}

/** The title the header draws: the config's, else "Admin". */
export const adminTitle: Signal<string> = signal("Admin");

/** The notifications the header's bell lists, oldest first. */
export const notifications: Signal<readonly AdminNotification[]> = signal<readonly AdminNotification[]>([]);

/** Whether the header's notification list is open. */
export const notificationsOpen: Signal<boolean> = signal(false);

let lastNotification = 0;

/** Add one notification to the list; answers its id. */
export const addNotification = (entry: { title: string; body?: string; kind?: AdminNotificationKind }): string => {
  lastNotification += 1;
  const id = `n${String(lastNotification)}`;
  notifications.value = [...notifications.value, { id, title: entry.title, ...(entry.body === undefined ? {} : { body: entry.body }), ...(entry.kind === undefined ? {} : { kind: entry.kind }), at: Date.now() }];
  return id;
};

/** Take every notification away. */
export const clearNotifications = (): void => {
  notifications.value = [];
};
