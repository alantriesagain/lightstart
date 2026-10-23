/**
 * What a model's row type reads off its schema, held by the type checker:
 * `npm run typecheck` fails when a line below stops meaning what it says.
 */

import T from "../../types/index.js";
import { defineModel } from "../index.ts";

/** @import { ModelRow } from "../types.ts" */

const notes = defineModel("fx-notes", {
  title: T.string({ required: true }),
  done: T.boolean({ defaultValue: false }),
  rank: T.number(0),
  parent: T.string({ defaultValue: null }),
  body: T.string(),
  author: T.belongs("users"),
});

const counters = defineModel("fx-counters", {
  id: T.number(),
  hits: T.number({ required: true }),
});

/** @typedef {ModelRow<typeof notes>} Note */
/** @typedef {ModelRow<typeof counters>} Counter */

/** @param {Note} note @param {Counter} counter */
export const reads = (note, counter) => {
  /** @type {string} */ const id = note.id;
  /** @type {string} */ const title = note.title;
  /** @type {boolean} */ const done = note.done;
  /** @type {number} */ const rank = note.rank;
  /** @type {string | null} */ const parent = note.parent;
  /** @type {number} */ const counterId = counter.id;
  // @ts-expect-error a field with neither a default nor required may be absent
  /** @type {string} */ const body = note.body;
  // @ts-expect-error a relationship field may be absent
  /** @type {string} */ const author = note.author;
  // @ts-expect-error a null default keeps null in the value
  /** @type {string} */ const orphan = note.parent;
  // @ts-expect-error an edit's patch is typed by the row
  const edited = notes.edit("a", { done: "yes" });
  return [id, title, done, rank, parent, counterId, body, author, orphan, edited];
};
