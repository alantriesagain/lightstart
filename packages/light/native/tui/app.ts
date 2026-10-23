/**
 * @bootstrapp/light/native/app: an app on a terminal in one call. `runApp`
 * puts a renderer over the terminal given (a `Terminal` on the screen, a
 * `TestTerminal` in a test), installs the classes styler when the app brings
 * one, mounts the app's view at the root, gives `focus` the focus from the
 * first frame (an `autofocus` attribute does the same from a template) and
 * starts the renderer. A key goes to `onKey` first, before the focused
 * element sees it; a Ctrl+C it did not take quits the process. Answers the
 * renderer.
 */
import { ClassStyler, configureClasses } from "./classes.ts";
import { KeyEvent } from "./events.ts";
import { TElement, TRoot } from "./node.ts";
import { Renderer } from "./renderer.ts";
import { Terminal } from "./terminal.ts";
import { View, mount } from "./view.ts";

/** What `runApp` takes: the app's view, the terminal, the classes styler when there is one, the element focused from the start, and the app's own keys. */
export interface AppOptions {
  app: View;
  term: Terminal;
  classes?: ClassStyler | null;
  focus?: TElement | null;
  onKey?: ((renderer: Renderer, e: KeyEvent) => boolean) | null;
}

export const runApp = ({ app, term, classes = null, focus = null, onKey = null }: AppOptions): Renderer => {
  if (classes !== null) configureClasses(classes);
  const root = new TRoot();
  const renderer = new Renderer(term, root);
  mount(app, root);
  if (focus !== null) renderer.focus = focus;
  renderer.onKey = (e: KeyEvent): boolean => {
    if (onKey !== null && onKey(renderer, e)) return true;
    if (e.ctrl && e.key === "char" && e.text === "c") {
      renderer.stop();
      process.exit(0);
    }
    return false;
  };
  renderer.start();
  return renderer;
};
