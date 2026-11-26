/**
 * @file The occurrences @lightstart/push reports to the page: a new FCM token
 * for this install, and a push that arrived while the app is on screen. Both
 * are events (something that happened), not signals (what something reads
 * now); a view subscribes with `on`.
 */

import { event } from "@lightstart/light/signals";
import type { PushMessage } from "../types.ts";

/** A new FCM token for this install, when Firebase rotates it. */
export const pushToken = event<{ token: string; platform?: string }>();

/** A push that arrived while the app is on screen. */
export const pushReceived = event<PushMessage>();
