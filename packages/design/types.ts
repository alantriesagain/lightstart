/**
 * @file What a design canvas is: the index a build writes, the bands a layout reads, the preview
 * options, the build and listing records, the server, and the render plan.
 */

/** One board's place and size in a canvas index. */
export type BoardIndex = {
  x: number;
  y: number;
  w: number;
  h: number;
  title?: string;
};

/** One note's place, size and words in a canvas index. */
export type NoteIndex = {
  x: number;
  y: number;
  w?: number;
  maxW?: number;
  text: string;
  kind?: string;
};

/** The `canvas.json` a build writes and the preview and render read. */
export type CanvasIndex = {
  title: string;
  boards: Record<string, BoardIndex>;
  notes: Record<string, NoteIndex>;
  [key: string]: unknown;
};

/** What `previewPage` adds to the index: a base for a canvas whose boards sit in `canvas/project`. */
export type PreviewOptions = {
  base?: string;
};

/** An index found on disk, its folder and the prefix its boards carry. */
export type CanvasSource = {
  file: string;
  base: string;
  index: CanvasIndex;
};

/** What a listing shows for one canvas. */
export type CanvasInfo = {
  name: string;
  boards: number;
  built: boolean;
};

/** What running a canvas's `build.mjs` answered. */
export type BuildResult = {
  ok: boolean;
  status: number;
  preview?: string;
  boards?: number;
};

/** The port and host a canvas server listens on. */
export type ServeOptions = {
  port?: number;
  host?: string;
};

/** A served canvas or canvas index. */
export type CanvasServer = {
  url: string;
  port: number;
  close: () => Promise<void>;
};

/** One board a layout writes. */
export type LayoutBoard = {
  file: string;
  title: string;
  w: number;
  h: number;
  html: string;
  note?: string;
};

/** One band of a canvas: its title, date, note and the boards in its row. */
export type LayoutBand = {
  title: string;
  date?: string;
  note: string;
  boards: LayoutBoard[];
};

/** What `layoutCanvas` writes. */
export type LayoutCanvas = {
  title: string;
  bands: LayoutBand[];
};

/** The distances and note measurements a layout uses; each has the value the band layout began with. */
export type LayoutOptions = {
  gap?: number;
  bandTitleMaxWidth?: number;
  bandNoteWidth?: number;
  bandNoteOffset?: number;
  bandNoteToBoards?: number;
  boardNoteGap?: number;
  bandGap?: number;
  noteMinWidth?: number;
  noteMaxWidth?: number;
  notePadding?: number;
  noteCharWidth?: number;
  noteLineHeight?: number;
  noteChrome?: number;
};

/** One board a render writes. */
export type RenderTarget = {
  file: string;
  name: string;
  source: string;
  path: string;
  width: number;
  height: number;
};

/** The boards a render writes and where they go. */
export type RenderPlan = {
  projectDir: string;
  canvas: string;
  dir: string;
  boards: RenderTarget[];
};
