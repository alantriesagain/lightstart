/**
 * @file The fixture's `count` mode: it opens the app's stores through its
 * context, adds a note, prints how many there are and stops the app.
 */

import type { ModeContext } from "@lightstart/app/tui";
import note from "../models/note.ts";

/** Add a note and print the count; answers 0. */
export const main = async (_argv: readonly string[], context: ModeContext): Promise<number> => {
  const app = await context.open();
  await note.add({ text: "from a mode" });
  const rows = await note.getAll();
  console.log(`notes ${String(rows.length)}`);
  await app.stop();
  return 0;
};
