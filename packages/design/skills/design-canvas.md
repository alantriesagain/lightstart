---
name: design-canvas
description: Add or change a design canvas under a project's design/ folder, build it, preview it locally, render it, and publish it when the session has the review tools
user_invocable: true
---

# Work on a design canvas

A canvas is a set of screens the owner reviews and edits, under `design/<canvas>/`. The app never serves it. Use this when adding a screen to a canvas, changing a band or its notes, rendering the boards, or publishing a canvas.

## The shape

- `design/<canvas>/build.mjs` is the build entry, and `directions.mjs` or `boards.mjs` is the canvas's source. It writes the boards, `canvas.json` and `canvas/project/` (gitignored), which is what gets published.
- The source is what you edit: `directions.mjs` for a phone canvas, or `boards.mjs`, a shell and a stylesheet for a canvas composed in rows. A build that uses `layoutCanvas` keeps its bands in the source it passes it.
- `BOARDS.md`, the generated `*.dc.html`, `canvas.json`, `canvas/project/` and `preview.html` are outputs. Do not edit them by hand.
- Photos live in `assets.json` by uploaded address for a canvas that uses them, or are already blob addresses in the shell that draws them. Upload a new photo to the canvas first.

## Commands

```bash
light design                  # list the canvases under design/
light design <canvas>         # build, then serve the local preview
light design <canvas> --build # build only
light design:build [canvas]   # build one canvas or all of them
light design:serve <canvas> [--port 5097] [--host 127.0.0.1]
light design:render <canvas> [board...]
```

The preview is a local layout, not the canvas itself: it draws each board in an iframe with its notes and lets you zoom. It is generated from `canvas.json` after the build.

`light design:render <canvas>` writes each board to `design/renders/<canvas>/<board>.png` at its own size through Playwright. Name boards to render only those.

`light serve` also starts every canvas at `http://localhost:5097/`, or the next free port, when the project declares `@lightstart/design`. The index links each canvas and a missing preview is written from `canvas.json`; an ephemeral server skips it.

## Adding or changing a screen

1. Find the band the screen belongs to in the source. Add the board to that band, or add a band with its title and date.
2. Write the board's markup in the same style as its neighbours, using the canvas's own tokens and icons.
3. Add a note when the screen decides something the owner must keep: a rule, a state, or a difference from the app.
4. Run `light design <canvas> --build`, then serve it and look at the band.
5. Render it with `light design:render <canvas>` when the change needs a PNG for review.
6. Run `light check` when the change also touches the app.

A feature change updates its canvas band in the same change. A new screen is linked from its band; a removed one leaves the index.

## Publishing

1. Read the live `project/canvas.json` with the review tool the session has.
2. Diff it against the committed `canvas.json`. The owner edits on the canvas: boards moved or deleted, a note made wider.
3. Port those edits into the source, then copy the live file over `canvas.json`.
4. Run `light design <canvas> --build`.
5. Publish to the canvas URL with `root` set to `design/<canvas>/canvas`, `file_path` to `canvas/project/canvas.json`, every changed `project/*.dc.html` in `files`, and `null` for a board that was removed. A publish against a stale index is refused: read the live file again and merge.

Without the review tools, stop after step 4 and report what is ready. Do not claim a canvas was published.

## Never

- Never edit a generated board, `canvas.json`, `BOARDS.md` or `preview.html`.
- Never put `design/` in the app's bundle folders.
- Never publish over a live canvas without reading its index first.
- Never write a photo's local filename into a published board; upload it and use its address.
