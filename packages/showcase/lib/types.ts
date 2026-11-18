/// <reference lib="dom" />
/**
 * @lightstart/showcase: the types these modules share.
 */

export type Renderable = import("@lightstart/light/html").Renderable;

/** lib/example-parser.ts: one `@part` or `@slot` entry. */
export interface DocEntry {
  name: string;
  description: string;
}

/** One component's doc comment: its description, parts and slots. */
export interface ComponentDoc {
  description: string;
  parts: DocEntry[];
  slots: DocEntry[];
}

/** One row of the components' tags table: where a tag's module and stylesheet live, and what its doc says. */
export interface ComponentTag {
  module: string;
  style: string | null;
  extends: string | null;
  uses: string[];
  doc: ComponentDoc;
}

/** The components' tags table: a `lc-<name>` tag to what it is made of. */
export type ComponentTags = Record<string, ComponentTag>;

/** lib/registry.ts: component names grouped by their source folder. */
export type ComponentList = Record<string, string[]>;

/** One browsable catalogue category, as `lib/categories.ts` declares it. */
export interface ShowcaseCategory {
  id: string;
  label: string;
  icon: string;
  description: string;
}

/** A category with the components the tags table puts in it. */
export type ShowcaseCategoryListing = ShowcaseCategory & { components: string[] };

/** lib/registry.ts: one property, read off its `T.*` descriptor. */
export interface ComponentPropertyMeta {
  type: string;
  defaultValue?: Renderable;
  enum?: readonly string[];
  required?: boolean;
  attribute?: boolean;
}

/** lib/registry.ts: what a component definition tells the showcase about itself. */
export interface ComponentMeta {
  tag: string;
  properties: Record<string, ComponentPropertyMeta>;
  hasStyle: boolean;
  module: import("@lightstart/light").ComponentDefinition;
}

/** lib/registry.ts: a component's definition metadata plus everything read out of its doc comment. */
export type LoadedComponent = ComponentMeta & {
  description: string;
  parts: DocEntry[];
  slots: DocEntry[];
};
