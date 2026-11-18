/**
 * The showcase's nine categories: what a reader browses, in the order they are
 * offered.
 *
 * The component list itself stays the tags table's (`getComponentList`), so a
 * new component appears without an edit here. This module only decides which
 * directories are a catalogue category and how each one introduces itself; a
 * directory this list does not name is never browsable.
 */

import { getComponentList } from "./registry.ts";
import type { ComponentTags, ShowcaseCategory, ShowcaseCategoryListing } from "./types.ts";

export const CATEGORIES: ShowcaseCategory[] = [
  {
    id: "form",
    label: "Form",
    icon: "list-checks",
    description: "Controls that collect a value, and the form that draws them from a field list",
  },
  {
    id: "display",
    label: "Display",
    icon: "eye",
    description: "Text, media, charts and tables: the components that show what the app knows",
  },
  {
    id: "layout",
    label: "Layout",
    icon: "layout-grid",
    description: "Cards, grids and panes that arrange a screen",
  },
  {
    id: "navigation",
    label: "Navigation",
    icon: "compass",
    description: "Menus, tabs, trees and breadcrumbs: how a reader moves between places",
  },
  {
    id: "overlay",
    label: "Overlay",
    icon: "layers",
    description: "Modals, drawers, sheets and popovers, stacked and dismissed by one controller",
  },
  {
    id: "feedback",
    label: "Feedback",
    icon: "loader",
    description: "What the app says while it works, succeeds, or has nothing to show",
  },
  {
    id: "app",
    label: "App shell",
    icon: "smartphone",
    description: "The frame around a screen: headers, bottom navigation, scrollers and decks",
  },
  {
    id: "page",
    label: "Page sections",
    icon: "file-text",
    description: "Marketing blocks a landing page is assembled from",
  },
  {
    id: "utility",
    label: "Utility",
    icon: "pen-tool",
    description: "Dark mode, drag and drop, device facts and other behaviour without chrome",
  },
];

const byId = new Map<string, ShowcaseCategory>(
  CATEGORIES.map((category) => [category.id, category] as const),
);

export const categoryById = (id: string): ShowcaseCategory | null => byId.get(id) ?? null;

export const humanize = (name: string): string =>
  String(name || "")
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

/**
 * Every browsable category with the components it holds, alphabetically within
 * a category and empty categories dropped.
 *
 * @param tags the components' tags table, which lists the components
 * @param query filters components by name, and drops a category that keeps none
 */
export const browsableCategories = (
  tags: ComponentTags,
  query = "",
): ShowcaseCategoryListing[] => {
  const grouped = getComponentList(tags);
  const needle = query.trim().toLowerCase();
  const listings: ShowcaseCategoryListing[] = [];
  for (const category of CATEGORIES) {
    const components: string[] = (grouped[category.id] ?? [])
      .filter((name) => !needle || name.toLowerCase().includes(needle))
      .sort();
    if (components.length) listings.push({ ...category, components });
  }
  return listings;
};
