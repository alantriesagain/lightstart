/**
 * @file A menu bar: a brand, the menus beside it, and the open menu's dropdown in a layer over what is
 * below. A press on a title opens its menu (another title switches, the open one closes), a press on an
 * item runs it and closes, a press outside the dropdown closes, and a press on a title dragged onto an
 * item runs it on release. The keys move over the enabled items (wrapping and skipping separators) and
 * between menus; Enter runs the selected item and Escape closes.
 */
import { TBox, View, find, html, signal, stringWidth } from "@lightstart/light/native/tui";
import type { KeyEvent, MouseEvent, Signal, TemplateResult } from "@lightstart/light/native/tui";
import { palette } from "./palette.ts";

/** A row of a menu: a label, the keys that run it, and what it does. A separator has no label. */
export class MenuItem {
  label: string;
  keys: string;
  enabled: boolean;
  separator: boolean;
  onRun: (() => void) | null;

  constructor(label: string, keys = "", onRun: (() => void) | null = null) {
    this.label = label;
    this.keys = keys;
    this.enabled = true;
    this.separator = false;
    this.onRun = onRun;
  }

  static separator(): MenuItem {
    const item = new MenuItem("", "", null);
    item.separator = true;
    item.enabled = false;
    return item;
  }
}

/** A titled list of items. */
export class Menu {
  title: string;
  items: MenuItem[];

  constructor(title: string, items: MenuItem[] = []) {
    this.title = title;
    this.items = items;
  }
}

/** The width of a title as the bar writes it: a space, the title, a space. */
const titleWidth = (title: string): number => 2 + stringWidth(title);

/** The width the widest row needs: its label, three spaces, and its keys. */
const contentWidth = (menu: Menu): number => {
  let width = 0;
  for (const item of menu.items) {
    if (item.separator) continue;
    const w = stringWidth(item.label) + (item.keys.length > 0 ? 3 + stringWidth(item.keys) : 0);
    if (w > width) width = w;
  }
  return width;
};

export class MenuBar extends View {
  brand: Signal<string>;
  menus: Signal<Menu[]>;
  openIndex: Signal<number>;
  selected: Signal<number>;
  private dragging: boolean;

  constructor() {
    super();
    this.brand = signal("");
    this.menus = signal([] as Menu[]);
    this.openIndex = signal(-1);
    this.selected = signal(-1);
    this.dragging = false;
  }

  /** Replace the menus; an open menu out of range closes, one still there selects its first enabled item. */
  setMenus(menus: Menu[]): void {
    this.menus.value = menus;
    const at = this.openIndex.value;
    if (at < 0) return;
    if (at >= menus.length) this.close();
    else this.selected.value = this.firstEnabled(menus[at]);
  }

  /** Open menu `i`, selecting its first enabled item. */
  open(i: number): void {
    const menus = this.menus.value;
    if (i < 0 || i >= menus.length) {
      this.close();
      return;
    }
    this.openIndex.value = i;
    this.selected.value = this.firstEnabled(menus[i]);
    this.dragging = false;
  }

  close(): void {
    this.openIndex.value = -1;
    this.selected.value = -1;
    this.dragging = false;
  }

  /** Handle a key while a menu is open, answering whether it was used; closed, false. */
  key(e: KeyEvent): boolean {
    const at = this.openIndex.value;
    const menus = this.menus.value;
    if (at < 0 || at >= menus.length) return false;
    switch (e.key) {
      case "up":
        this.move(-1);
        return true;
      case "down":
        this.move(1);
        return true;
      case "left":
        this.open(at === 0 ? menus.length - 1 : at - 1);
        return true;
      case "right":
        this.open(at === menus.length - 1 ? 0 : at + 1);
        return true;
      case "enter":
        this.runItem(this.selected.value);
        if (this.openIndex.value === at) this.close();
        return true;
      case "escape":
        this.close();
        return true;
      default:
        return false;
    }
  }

  override render(): unknown {
    const menus = this.menus.value;
    return html`<box><box direction="row" bg=${palette.bandBg}><text bold fg=${palette.link}>${this.brand.value + " "}</text>${menus.map((m, i) => this.titleOf(m, i))}</box>${this.dropdown()}</box>`;
  }

  private titleOf(menu: Menu, index: number): TemplateResult {
    const open = this.openIndex.value === index;
    return html`<box bg=${open ? palette.selectedBg : ""} @mousedown=${(e: MouseEvent) => this.titleDown(index, e)} @mousemove=${(e: MouseEvent) => this.titleMove(e)} @mouseup=${(e: MouseEvent) => this.titleUp(e)}><text fg=${palette.paneText}>${" " + menu.title + " "}</text></box>`;
  }

  private dropdown(): TemplateResult | null {
    const at = this.openIndex.value;
    const menus = this.menus.value;
    if (at < 0 || at >= menus.length) return null;
    const menu = menus[at];
    const surface = palette.codeBg;
    const width = contentWidth(menu) + 4;
    const rows = menu.items.map((item, i) =>
      item.separator
        ? html`<hr fg=${palette.dim} @mousedown=${(e: MouseEvent) => e.consume()}>`
        : this.itemOf(item, i),
    );
    return html`<box layer backdrop layerX=${this.titleX(at)} layerY=${this.box.y + 1} width=${width} padding=1 border borderStyle="cell" borderColor=${palette.border} bg=${surface} shadow="#000000" @mousedown=${(e: MouseEvent) => this.layerDown(e)} @mousemove=${(e: MouseEvent) => this.layerMove(e)} @mouseup=${(e: MouseEvent) => this.layerUp(e)}>${rows}</box>`;
  }

  private itemOf(item: MenuItem, index: number): TemplateResult {
    const on = this.selected.value === index;
    const fg = item.enabled ? palette.paneText : palette.dim;
    return html`<box direction="row" bg=${on ? palette.selectedBg : ""} @mousedown=${(e: MouseEvent) => this.itemDown(index, e)}><text fg=${fg}>${item.label}</text><box flex=1></box><text fg=${palette.dim}>${item.keys}</text></box>`;
  }

  private firstEnabled(menu: Menu): number {
    for (let i = 0; i < menu.items.length; i++) {
      const item = menu.items[i];
      if (!item.separator && item.enabled) return i;
    }
    return -1;
  }

  private move(direction: number): void {
    const at = this.openIndex.value;
    const menus = this.menus.value;
    if (at < 0 || at >= menus.length) return;
    const items = menus[at].items;
    if (items.length === 0) return;
    let i = this.selected.value;
    for (let step = 0; step < items.length; step++) {
      i += direction;
      if (i < 0) i = items.length - 1;
      if (i >= items.length) i = 0;
      const item = items[i];
      if (!item.separator && item.enabled) {
        this.selected.value = i;
        return;
      }
    }
  }

  private runItem(index: number): void {
    const at = this.openIndex.value;
    const menus = this.menus.value;
    if (at < 0 || at >= menus.length) return;
    const item = menus[at].items[index];
    if (item === undefined || item.separator || !item.enabled) return;
    if (item.onRun !== null) item.onRun();
    this.close();
  }

  /** The x of title `i` on the bar, from the brand and the titles before it. */
  private titleX(i: number): number {
    const menus = this.menus.value;
    let x = this.box.x + stringWidth(this.brand.value + " ");
    for (let j = 0; j < i && j < menus.length; j++) x += titleWidth(menus[j].title);
    return x;
  }

  /** The title under (x, y) on the bar, or -1. */
  private titleAt(x: number, y: number): number {
    if (y !== this.box.y) return -1;
    const menus = this.menus.value;
    let left = this.box.x + stringWidth(this.brand.value + " ");
    for (let i = 0; i < menus.length; i++) {
      const right = left + titleWidth(menus[i].title);
      if (x >= left && x < right) return i;
      left = right;
    }
    return -1;
  }

  /** The item row under (x, y), from the dropdown's laid-out box, or -1 outside it. */
  private rowAt(e: MouseEvent): number {
    const drop = find(this.box, (el) => el instanceof TBox && el.layer);
    if (!(drop instanceof TBox)) return -1;
    const pad = drop.padding + (drop.border ? 1 : 0);
    if (e.x < drop.x + pad || e.x >= drop.x + drop.w - pad) return -1;
    const row = e.y - (drop.y + pad);
    const menu = this.menus.value[this.openIndex.value];
    if (menu === undefined || row < 0 || row >= menu.items.length) return -1;
    return row;
  }

  private titleDown(index: number, e: MouseEvent): void {
    if (this.titleAt(e.x, e.y) !== index) return;
    if (this.openIndex.value === index) {
      this.close();
      return;
    }
    this.open(index);
    this.dragging = true;
  }

  private titleMove(e: MouseEvent): void {
    if (!this.dragging) return;
    const row = this.rowAt(e);
    if (row < 0) return;
    const menu = this.menus.value[this.openIndex.value];
    if (menu === undefined) return;
    const item = menu.items[row];
    if (!item.separator && item.enabled) this.selected.value = row;
  }

  private titleUp(e: MouseEvent): void {
    if (!this.dragging) return;
    this.dragging = false;
    const row = this.rowAt(e);
    if (row >= 0) this.runItem(row);
  }

  private layerDown(e: MouseEvent): void {
    const title = this.titleAt(e.x, e.y);
    if (title >= 0) {
      if (this.openIndex.value === title) {
        this.close();
        return;
      }
      this.open(title);
      this.dragging = true;
      return;
    }
    this.close();
  }

  private layerMove(e: MouseEvent): void {
    if (!this.dragging) return;
    const row = this.rowAt(e);
    if (row < 0) return;
    const menu = this.menus.value[this.openIndex.value];
    if (menu === undefined) return;
    const item = menu.items[row];
    if (!item.separator && item.enabled) this.selected.value = row;
  }

  private layerUp(e: MouseEvent): void {
    if (!this.dragging) return;
    this.dragging = false;
    const row = this.rowAt(e);
    if (row >= 0) this.runItem(row);
  }

  private itemDown(index: number, e: MouseEvent): void {
    e.consume();
    this.dragging = false;
    this.runItem(index);
  }
}
