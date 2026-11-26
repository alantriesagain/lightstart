/**
 * @file The place an app or a package describes its queue kinds through:
 * `queueKinds` is filled with one `QueueKind` per submission kind, and the
 * review queue reads them to title a row, group it and draw its detail.
 */

import { defineSlot } from "@lightstart/app";

import type { QueueKind } from "../types.ts";

/** The queue's kinds, filled by the package and by an app or a package whose kinds of its own wait on a review. */
export const queueKinds = defineSlot<QueueKind>("queue.kinds");
