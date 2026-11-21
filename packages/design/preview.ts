/**
 * @file The local preview page: the whole canvas laid out as claude.ai lays it out, each board in
 * an iframe where it sits, the notes beside them, and a zoom control. It is a layout preview, not
 * the canvas itself.
 */
import type { CanvasIndex, PreviewOptions } from "./types.ts";

const esc = (s: unknown): string => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/**
 * The HTML of a canvas's local preview, drawn from the index a build wrote.
 *
 * @param index The canvas index.
 * @param options `base` prefixes each board's iframe, for a canvas whose boards sit in `canvas/project`.
 * @returns The preview page's HTML.
 */
export const previewPage = ({ title, boards, notes }: CanvasIndex, { base = "" }: PreviewOptions = {}): string => {
  const W = Math.max(...Object.values(boards).map((b) => b.x + b.w)) + 80;
  const H = Math.max(...Object.values(boards).map((b) => b.y + b.h), ...Object.values(notes).map((n) => n.y + 200)) + 120;
  const parts = [
    ...Object.entries(boards).map(
      ([file, b]) =>
        `<div class="board" style="left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px"><div class="cap">${esc(file.replace(".dc.html", ""))} · ${esc(b.title || "")}</div><iframe src="${esc(base)}${esc(file)}" loading="lazy" title="${esc(file)}"></iframe></div>`,
    ),
    ...Object.values(notes).map(
      (n) =>
        `<div class="${n.kind === "title1" ? "band" : "note"}" style="left:${n.x}px;top:${n.y}px;width:${Math.min(n.w || n.maxW || 440, 1400)}px">${esc(n.text)}</div>`,
    ),
  ];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)} · preview</title>
<style>
html,body{margin:0;background:#e9e7e2;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#111}
.bar{position:fixed;top:0;left:0;right:0;z-index:9;display:flex;gap:16px;align-items:center;padding:10px 16px;background:#111;color:#fff;font-size:13px}
.stage{position:relative;transform-origin:0 0;margin-top:48px;width:${W}px;height:${H}px}
.board{position:absolute;background:#fff;border-radius:28px;box-shadow:0 10px 30px rgb(0 0 0 / .18)}
.board iframe{width:100%;height:100%;border:0;border-radius:28px;background:#fff}
.cap{position:absolute;top:-26px;left:4px;right:0;font-size:12px;color:#444;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.note{position:absolute;padding:14px 16px;background:#fff6c8;border-radius:12px;font-size:13px;line-height:1.45;white-space:pre-wrap;box-shadow:0 4px 14px rgb(0 0 0 / .1)}
.band{position:absolute;font-size:34px;font-weight:800;letter-spacing:-.02em;white-space:nowrap}
</style></head><body>
<div class="bar"><strong>${esc(title)}</strong><span>zoom</span><input id="z" type="range" min="0.25" max="1" step="0.05" value="0.6"><span id="zv">60%</span><span style="opacity:.7">${Object.keys(boards).length} boards · a local preview of canvas.json, not the canvas itself</span></div>
<div class="stage" id="stage">${parts.join("")}</div>
<script>const z=document.getElementById('z'),s=document.getElementById('stage'),v=document.getElementById('zv');const apply=()=>{s.style.transform='scale('+z.value+')';v.textContent=Math.round(z.value*100)+'%';document.body.style.height=(${H}*z.value+60)+'px';document.body.style.width=(${W}*z.value)+'px'};z.oninput=apply;apply();</script>
</body></html>
`;
};
