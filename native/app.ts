/**
 * @bootstrapp/light/native/app: an app on a terminal in one call. `runApp`
 * puts a renderer over the terminal given (a `Terminal` on the screen, a
 * `TestTerminal` in a test), installs the classes styler when the app brings
 * one, mounts the app's view at the root and starts the renderer. A key goes
 * to `onKey` first, before the focused element sees it; a Ctrl+C it did not
 * take quits the process. Answers the renderer.
 */
import { ClassStyler, configureClasses } from "../tdom/classes.ts";
import { KeyEvent } from "../tdom/events.ts";
import { TRoot } from "../tdom/node.ts";
import { Renderer } from "../tdom/renderer.ts";
import { Terminal } from "../tdom/terminal.ts";
import { View, mount } from "../tdom/view.ts";

/** What `runApp` takes: the app's view, the terminal, the classes styler when there is one, and the app's own keys. */
export interface AppOptions {
  app: View;
  term: Terminal;
  classes?: ClassStyler | null;
  onKey?: ((renderer: Renderer, e: KeyEvent) => boolean) | null;
}

export const runApp = ({ app, term, classes = null, onKey = null }: AppOptions): Renderer => {
  if (classes !== null) configureClasses(classes);
  const root = new TRoot();
  const renderer = new Renderer(term, root);
  mount(app, root);
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
