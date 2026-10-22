/**
 * @file What the members' tests share: a wait, a wait for a condition, and a view mounted on a root and
 * painted headless to a screen whose rows the checks read.
 */
import { Caret, Clip, DEFAULT_STYLE, Screen, TRoot, View, frames, layout, mount, paint, unmount } from "@bootstrapp/light/native/tui";

/** `ms` later. */
export const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** Whether `what` came true within `ms`, polled every 20 ms. */
export const until = async (what: () => boolean, ms = 15000): Promise<boolean> => {
  const start = Date.now();
  while (!what() && Date.now() - start < ms) await wait(20);
  return what();
};

/** A view mounted on a root of its own and painted headless, `w` by `h` cells. */
export class Headless {
  readonly root = new TRoot();
  readonly view: View;
  readonly w: number;
  readonly h: number;

  constructor(view: View, w: number, h: number) {
    this.view = view;
    this.w = w;
    this.h = h;
    mount(view, this.root);
  }

  /** The screen as drawn now: three frames flushed and laid out, then painted. */
  paint(): Screen {
    for (let i = 0; i < 3; i++) {
      frames.flush();
      layout(this.root, this.w, this.h, DEFAULT_STYLE);
    }
    const s = new Screen(this.w, this.h);
    paint(this.root, s, new Clip(0, 0, this.w, this.h), DEFAULT_STYLE, new Caret(), null);
    return s;
  }

  /** The screen's rows as text. */
  screen(): string[] {
    return this.paint().text().split("\n");
  }

  unmount(): void {
    unmount(this.view);
  }
}
