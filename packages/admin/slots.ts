/**
 * @file The places the admin leaves open for a tool: a section in the sidebar,
 * a command in the palette, and an item in the header. A tool fills them from
 * its extension's `fills` (`adminSections.entry(item)`), and the admin shell
 * draws `items`.
 */

import { defineSlot } from "@lightstart/app";
import type { Slot } from "@lightstart/app";

/** One sidebar entry. */
export interface AdminSection {
  id: string;
  title: string;
  icon: string;
  path: string;
  order?: number;
}

/** One command in the palette. */
export interface AdminCommand {
  id: string;
  title: string;
  icon?: string;
  run(): unknown;
  order?: number;
}

/** One element the header draws after the title. */
export interface AdminHeaderItem {
  id: string;
  tag: string;
  order?: number;
}

/** The sidebar's entries, filled by tools. */
export const adminSections: Slot<AdminSection> = defineSlot<AdminSection>("admin.sections");

/** The palette's commands, filled by tools. */
export const adminCommands: Slot<AdminCommand> = defineSlot<AdminCommand>("admin.commands");

/** The header items, filled by tools; each is drawn by its own custom element `tag`. */
export const adminHeader: Slot<AdminHeaderItem> = defineSlot<AdminHeaderItem>("admin.header");
