// node-only
/**
 * @file The render plan: which boards a render writes, the file each one is read from, the PNG it
 * writes, and the selection by board name or file. The screenshot itself is a separate step.
 */
import { join } from "node:path";
import { done, eq } from "@lightstart/test/assert.ts";
import { planRenders } from "../render.ts";
import type { CanvasIndex } from "../types.ts";

const project = "/project";
const index: CanvasIndex = {
  title: "Phone",
  boards: {
    "Home.dc.html": { x: 0, y: 0, w: 390, h: 844, title: "Home" },
    "Place.dc.html": { x: 490, y: 0, w: 390, h: 844, title: "A place" },
  },
  notes: {},
};

const all = planRenders(project, "phone", index);
eq("the canvas is named", all.canvas, "phone");
eq("the PNGs go under design/renders", all.dir, join(project, "design", "renders", "phone"));
eq("every board is planned", String(all.boards.length), "2");
eq(
  "a board keeps its own size and gets a PNG",
  JSON.stringify(all.boards[0]),
  JSON.stringify({
    file: "Home.dc.html",
    name: "Home",
    source: join(project, "design", "phone", "Home.dc.html"),
    path: join(project, "design", "renders", "phone", "Home.png"),
    width: 390,
    height: 844,
  }),
);

const one = planRenders(project, "phone", index, ["Place"]);
eq("a board is selected by its name", one.boards.map((board) => board.name).join(","), "Place");
const byFile = planRenders(project, "phone", index, ["Home.dc.html"]);
eq("a board is selected by its file", byFile.boards.map((board) => board.name).join(","), "Home");
eq("an unknown board selects none", String(planRenders(project, "phone", index, ["Nope"]).boards.length), "0");

const staged = planRenders(project, "admin", index, [], "canvas/project/");
eq("a staged board is read under its base", staged.boards[0]?.source ?? "missing", join(project, "design", "admin", "canvas", "project", "Home.dc.html"));
done();
