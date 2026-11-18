/// <reference lib="dom" />
/**
 * @file What the showcase reads off a component's files: its definition with
 * what its doc comment says (`loadComponent`), and the `<component>.demo.js`
 * beside it (`loadDemo`). Each is loaded on the first ask and answered from
 * memory after, counted as the page's work while it loads (`trackWork`). A
 * component's files are found through the components' tag table
 * (`componentTags()`, their `tags.json`), so a demo is loaded only here and
 * nothing an app renders pulls one in.
 */
import View, { trackWork } from "@lightstart/light";
import loaders from "@lightstart/components/loaders.js";
import tags from "@lightstart/components/tags.json" with { type: "json" };
import type { DemoExample } from "./demos.ts";
import { describeComponentDoc } from "./registry.ts";
import type { ComponentTags, LoadedComponent } from "./types.ts";

/** A component's demo: its description and its examples. */
export interface ComponentDemo {
  description: string;
  examples: DemoExample[];
}

const EMPTY_DEMO: ComponentDemo = { description: "", examples: [] };

/** The components' tag table: tag to module, stylesheet, base and the tags it renders. */
export const componentTags = (): ComponentTags => tags as ComponentTags;

/** One tag's generated loaders: its module, and its demo when it has one. */
interface ComponentLoader {
  module: () => Promise<unknown>;
  demo?: () => Promise<unknown>;
}

const loaderTable = loaders as Record<string, ComponentLoader>;

const loaderOf = (name: string): ComponentLoader => {
  const loader = loaderTable[`lc-${name}`];
  if (loader === undefined) throw new Error(`no component is named <lc-${name}>`);
  return loader;
};

/** The specifier of `<lc-name>`'s module, `@lightstart/components/<module>`. */
export const modulePath = (name: string, table: ComponentTags = componentTags()): string => {
  const entry = table[`lc-${name}`];
  if (entry === undefined) throw new Error(`no component is named <lc-${name}>`);
  return `@lightstart/components/${entry.module}`;
};

/** The specifier of `<lc-name>`'s stylesheet, or null when it has none. */
export const stylePath = (name: string, table: ComponentTags = componentTags()): string | null => {
  const style = table[`lc-${name}`]?.style ?? null;
  return style === null ? null : `@lightstart/components/${style}`;
};

const demos = new Map<string, Promise<ComponentDemo>>();
const components = new Map<string, Promise<LoadedComponent>>();

const demoOf = (value: unknown): ComponentDemo => {
  if (typeof value !== "object" || value === null) return EMPTY_DEMO;
  const description = Reflect.get(value, "description");
  const examples = Reflect.get(value, "examples");
  return { description: typeof description === "string" ? description : "", examples: Array.isArray(examples) ? (examples as DemoExample[]) : [] };
};

/** The demo beside `<lc-name>`, or an empty one when it has none. */
export const loadDemo = (name: string): Promise<ComponentDemo> => {
  let demo = demos.get(name);
  if (demo === undefined) {
    const load = async (): Promise<ComponentDemo> => {
      const loadDemoModule = loaderTable[`lc-${name}`]?.demo;
      if (loadDemoModule === undefined) return EMPTY_DEMO;
      try {
        const module: unknown = await loadDemoModule();
        return demoOf(typeof module === "object" && module !== null ? Reflect.get(module, "default") : null);
      } catch {
        return EMPTY_DEMO;
      }
    };
    demo = trackWork(load(), "showcase:demo");
    demos.set(name, demo);
  }
  return demo;
};

/** `<lc-name>`'s definition metadata, and its doc comment's description, parts and slots. */
export const loadComponent = (name: string): Promise<LoadedComponent> => {
  let component = components.get(name);
  if (component === undefined) {
    const load = async (): Promise<LoadedComponent> => {
      const loader = loaderOf(name);
      const module: unknown = await loader.module();
      const definition = typeof module === "object" && module !== null ? Reflect.get(module, "default") : undefined;
      return describeComponentDoc(definition as Parameters<typeof describeComponentDoc>[0], name, componentTags()[`lc-${name}`].doc);
    };
    component = trackWork(load(), "showcase:component");
    components.set(name, component);
  }
  return component;
};

const defined = new Set<string>();

/**
 * Define `<lc-tag>` and everything its definition needs (its base first, then the tags it renders),
 * once per page, through the generated loaders, so a built page defines a component no view of the
 * app writes.
 */
export const defineTag = async (tag: string, table: ComponentTags = componentTags()): Promise<void> => {
  if (defined.has(tag) || customElements.get(tag) !== undefined) return;
  const entry = table[tag];
  const loader = loaderTable[tag];
  if (entry === undefined || loader === undefined) return;
  defined.add(tag);
  try {
    if (entry.extends) await defineTag(entry.extends, table);
    const module: unknown = await loader.module();
    const definition = typeof module === "object" && module !== null ? Reflect.get(module, "default") : undefined;
    if (definition !== undefined) View.define(definition as Parameters<typeof View.define>[0]);
    await Promise.all(entry.uses.map((used) => defineTag(used, table)));
  } catch (error) {
    defined.delete(tag);
    throw error;
  }
};
