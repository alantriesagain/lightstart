// node-only
/**
 * @file The band layout: each band's title, date and note, its boards in a row with the gap, a
 * board's note under it, and the `canvas.json` and `BOARDS.md` it writes.
 */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { done, eq, ok } from "@lightstart/test/assert.ts";
import { layoutCanvas } from "../layout.ts";
import type { CanvasIndex, LayoutCanvas } from "../types.ts";

const canvas: LayoutCanvas = {
  title: "Demo",
  bands: [
    {
      title: "One",
      date: "Jan 1",
      note: "A note.",
      boards: [
        { file: "Home.dc.html", title: "Home", w: 390, h: 844, html: "<x-home></x-home>", note: "Home note." },
        { file: "Detail.dc.html", title: "Detail", w: 390, h: 844, html: "<x-detail></x-detail>" },
      ],
    },
    {
      title: "Two",
      note: "Second.",
      boards: [{ file: "Wide.dc.html", title: "Wide", w: 800, h: 600, html: "<x-wide></x-wide>" }],
    },
  ],
};

const dir = mkdtempSync(join(tmpdir(), "light-design-layout-"));
try {
  const count = layoutCanvas(dir, canvas);
  eq("every board is written", String(count), "3");
  const index = JSON.parse(readFileSync(join(dir, "canvas.json"), "utf8")) as CanvasIndex;
  eq("the index keeps its title", index.title, "Demo");
  eq("the boards are in band order", JSON.stringify(index["order"]), JSON.stringify(["Home.dc.html", "Detail.dc.html", "Wide.dc.html"]));
  eq("a first board sits under its band's note", JSON.stringify(index.boards["Home.dc.html"]), JSON.stringify({ x: 0, y: 201, w: 390, h: 844, title: "Home" }));
  eq("a next board follows with the gap", JSON.stringify(index.boards["Detail.dc.html"]), JSON.stringify({ x: 510, y: 201, w: 390, h: 844, title: "Detail" }));
  eq("a later band starts below the boards and its notes", JSON.stringify(index.boards["Wide.dc.html"]), JSON.stringify({ x: 0, y: 1547, w: 800, h: 600, title: "Wide" }));
  eq("a band carries its date", JSON.stringify(index.notes["band-0"]), JSON.stringify({ x: 0, y: 0, text: "One · Jan 1", kind: "title1", maxW: 1600 }));
  eq("a band with no date carries only its title", JSON.stringify(index.notes["band-1"]), JSON.stringify({ x: 0, y: 1346, text: "Two", kind: "title1", maxW: 1600 }));
  eq("a band's note sits under it", JSON.stringify(index.notes["band-0-note"]), JSON.stringify({ x: 0, y: 80, w: 900, text: "A note." }));
  eq("a board's note sits under it", JSON.stringify(index.notes["Home"]), JSON.stringify({ x: 0, y: 1075, w: 390, text: "Home note." }));
  ok("a board's HTML is written", readFileSync(join(dir, "Home.dc.html"), "utf8").includes("<x-home>"));
  const md = readFileSync(join(dir, "BOARDS.md"), "utf8");
  ok("BOARDS.md lists a band", md.includes("## One · Jan 1"));
  ok("BOARDS.md lists a board", md.includes("- Home: Home"));
  ok("BOARDS.md carries a band's note", md.includes("A note."));

  layoutCanvas(dir, canvas, { gap: 10 });
  const tightened = JSON.parse(readFileSync(join(dir, "canvas.json"), "utf8")) as CanvasIndex;
  eq("the gap is an option", String(tightened.boards["Detail.dc.html"]?.x), "400");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
done();
