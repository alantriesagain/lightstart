/**
 * @file `tasks-tui --export`: print every task as one JSON line, its list's name with it, from the
 * files under `--data` (the current folder by default), and exit, the terminal never started.
 */
import { resolve } from "node:path";
import { openJsonl } from "@lightstart/light/model/jsonl";
import { fileIO } from "@lightstart/app/tui/file.ts";
import list from "../models/list.ts";
import task from "../models/task.ts";

export const main = async (argv: readonly string[]): Promise<number> => {
  const at = argv.indexOf("--data");
  const dir = resolve(at >= 0 && at + 1 < argv.length ? (argv[at + 1] ?? ".") : ".");
  const store = await openJsonl({ name: "main", dir, io: fileIO(dir), models: [list, task] });
  const names = new Map<string, string>();
  for (const row of await list.getAll()) names.set(String(row.id), String(row.name));
  for (const row of await task.getAll({ order: "addedAt" })) console.log(JSON.stringify({ list: names.get(String(row.list)) ?? "", title: row.title, done: row.done === true }));
  await store.close();
  return 0;
};
