/**
 * @file The slot an app or an extension fills with the places its inbox lines
 * come from. The `notifications` controller reads it; a fill is
 * `{ id, list, retain? }`, and withdrawing it drops that source's plain lines.
 */

import { defineSlot } from "@lightstart/app/slots.ts";
import type { NotificationSource } from "../types.ts";

/** The places the inbox reads; fill it with `{ id, list, retain? }`. */
export const notificationSources = defineSlot<NotificationSource>("notifications.sources");
