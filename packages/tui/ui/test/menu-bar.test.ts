/**
 * @file The menu bar: a press on a title opens its menu and another title switches; a press on the
 * backdrop closes; the keys move over the enabled items, switch menus, run with Enter and close with
 * Escape; a title dragged onto an item runs it on release; and the painted dropdown sits under its
 * title with the keys right-aligned.
 */
import { KeyEvent, MouseEvent, TElement, hitTestLayers } from "@lightstart/light/native/tui";
import { done, eq, ok } from "@light/test/assert.ts";
import { Headless } from "@light/test/headless.ts";
import { Menu, MenuBar, MenuItem } from "../menu-bar.ts";

const runs: string[] = [];
const file = new Menu("File", [
  new MenuItem("New", "ctrl+n", () => runs.push("new")),
  new MenuItem("Open", "ctrl+o", () => runs.push("open")),
  MenuItem.separator(),
  new MenuItem("Quit", "q", () => runs.push("quit")),
]);
const undo = new MenuItem("Undo", "u", () => runs.push("undo"));
undo.enabled = false;
const edit = new Menu("Edit", [undo, new MenuItem("Redo", "r", () => runs.push("redo"))]);

const view = new MenuBar();
view.brand.value = "light";
view.setMenus([file, edit]);
const head = new Headless(view, 40, 14);

const key = (name: string): KeyEvent => new KeyEvent(name, "", false, false, false);

let held: TElement | null = null;
const press = (x: number, y: number): void => {
  held = hitTestLayers(head.root, x, y);
  if (held !== null) held.dispatch(new MouseEvent("mousedown", x, y, 0, false, false, false));
  head.paint();
};
const move = (x: number, y: number): void => {
  if (held === null) return;
  held.dispatch(new MouseEvent("mousemove", x, y, 0, false, false, false));
  head.paint();
};
const release = (x: number, y: number): void => {
  if (held === null) return;
  held.dispatch(new MouseEvent("mouseup", x, y, 0, false, false, false));
  held = null;
  head.paint();
};

const rows = (): string[] => head.screen();
eq("the bar is one row: the brand bold, then the titles in their spaces", rows()[0].slice(0, 17), "light  File  Edit");
eq("closed, no menu is open", String(view.openIndex.value), "-1");
ok("closed, a key is not used", !view.key(key("down")));

press(6, 0);
eq("a press on a title opens its menu", String(view.openIndex.value), "0");
eq("and selects its first enabled item", String(view.selected.value), "0");
eq("the dropdown's top edge is under the title", rows()[1].slice(6, 23), "▁".repeat(17));
eq("the widest row puts the keys at the right border", rows()[3].slice(6, 23), "▏ New    ctrl+n ▕");
eq("a short key is right-aligned too", rows()[6].slice(6, 23), "▏ Quit        q ▕");
eq("a separator is a dim rule", rows()[5].slice(6, 23), "▏ ───────────── ▕");

press(12, 0);
eq("a press on another title switches to it", String(view.openIndex.value), "1");
eq("and selects its first enabled item, skipping the disabled one", String(view.selected.value), "1");

view.open(0);
eq("opening a menu selects its first item", String(view.selected.value), "0");
view.key(key("down"));
eq("Down moves to the next item", String(view.selected.value), "1");
view.key(key("down"));
eq("and over a separator", String(view.selected.value), "3");
view.key(key("down"));
eq("wrapping round", String(view.selected.value), "0");
view.key(key("up"));
eq("Up wraps back to the last item", String(view.selected.value), "3");
view.key(key("escape"));
eq("Escape closes", String(view.openIndex.value), "-1");

view.open(1);
eq("a disabled first item leaves the next one selected", String(view.selected.value), "1");
view.key(key("up"));
eq("Up skips the disabled item and wraps to the enabled one", String(view.selected.value), "1");
view.open(0);
view.key(key("right"));
eq("Right switches to the next menu", String(view.openIndex.value), "1");
view.key(key("left"));
eq("Left switches back", String(view.openIndex.value), "0");
view.key(key("right"));
view.key(key("right"));
eq("the menus wrap", String(view.openIndex.value), "0");

view.open(0);
view.key(key("down"));
runs.length = 0;
view.key(key("enter"));
eq("Enter runs the selected item", runs.join(","), "open");
eq("and closes the menu", String(view.openIndex.value), "-1");

view.open(0);
press(30, 5);
eq("a press on the backdrop closes", String(view.openIndex.value), "-1");

view.open(0);
press(6, 0);
eq("a press on the open title closes it", String(view.openIndex.value), "-1");

press(6, 0);
move(8, 3);
release(8, 3);
eq("a title dragged onto an item runs it on release", runs.join(","), "open,new");
eq("and closes", String(view.openIndex.value), "-1");

press(6, 0);
move(8, 12);
release(8, 12);
eq("a release over nothing leaves the menu open", String(view.openIndex.value), "0");

view.close();
head.unmount();
done();
