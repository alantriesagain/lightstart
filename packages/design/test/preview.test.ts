/**
 * @file The local preview page: every board where the index puts it, the notes and the band, the
 * base of a staged canvas, and the escaping of a title and a note.
 */
import { done, eq, ok } from "@lightstart/test/assert.ts";
import { previewPage } from "../preview.ts";
import type { CanvasIndex } from "../types.ts";

const index: CanvasIndex = {
  title: "Demo on a phone",
  boards: {
    "Home.dc.html": { x: 0, y: 100, w: 390, h: 844, title: "Home" },
    "Place.dc.html": { x: 490, y: 100, w: 390, h: 844, title: "A place" },
  },
  notes: {
    band: { x: 0, y: 0, text: "THE BAND", kind: "title1", maxW: 800 },
    note: { x: 0, y: 120, w: 440, text: "A note the owner keeps." },
  },
};

const html = previewPage(index);
ok("the first board sits where the index puts it", html.includes('<iframe src="Home.dc.html" loading="lazy" title="Home.dc.html"></iframe>'));
ok("the second board sits where the index puts it", html.includes('<iframe src="Place.dc.html" loading="lazy" title="Place.dc.html"></iframe>'));
ok("the bar counts the boards", html.includes("2 boards"));
ok("a board keeps its place and size", html.includes("left:490px;top:100px;width:390px;height:844px"));
ok("a note is drawn", /class="note"[^>]*>A note the owner keeps\.<\/div>/.test(html));
ok("a band is drawn", /class="band"[^>]*>THE BAND<\/div>/.test(html));
ok("a staged canvas prefixes its iframes", previewPage(index, { base: "canvas/project/" }).includes('<iframe src="canvas/project/Home.dc.html"'));
const escaped = previewPage({ ...index, title: "A & B", notes: { n: { x: 0, y: 0, text: "<script>" } } });
ok("a title is escaped", escaped.includes("A &amp; B"));
ok("a note is escaped", escaped.includes("&lt;script>"));
eq("the page is HTML", html.slice(0, 15), "<!doctype html>");
done();
