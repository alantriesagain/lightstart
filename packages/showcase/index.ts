/// <reference lib="dom" />
/**
 * @file `@lightstart/showcase`: light's component catalogue. This module is its data and its loaders;
 * the views (`showcase-catalogue`, `showcase-component-doc`, `showcase-preview`,
 * `showcase-property-editor`, `showcase-sink` and the theme tools) are imported by path,
 * `@lightstart/showcase/views/<name>.js`, each defining its tag.
 */
export { CATEGORIES, browsableCategories, categoryById, humanize } from "./lib/categories.ts";
export { collectThemeTokens } from "./lib/collect.ts";
export { codeOf } from "./lib/demos.ts";
export type { DemoExample } from "./lib/demos.ts";
export { extractDescription, extractParts, extractSlots } from "./lib/example-parser.ts";
export { componentTags, loadComponent, loadDemo, modulePath, stylePath } from "./lib/load.ts";
export type { ComponentDemo } from "./lib/load.ts";
export { describeComponent, getComponentList, getDefaultValues } from "./lib/registry.ts";
export { SKIN_ATTRIBUTE, applySkin, clearSkin, skinScope } from "./lib/skins.ts";
export { STARTER_THEME } from "./lib/starter-theme.ts";
export { themeVariables } from "./lib/theme-vars.ts";
export type { ThemeVariable } from "./lib/theme-vars.ts";
export type { ComponentList, ComponentMeta, ComponentPropertyMeta, ComponentTag, ComponentTags, DocEntry, LoadedComponent, Renderable, ShowcaseCategory, ShowcaseCategoryListing } from "./lib/types.ts";
