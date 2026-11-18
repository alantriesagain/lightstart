/// <reference lib="dom" />
/**
 * The showcase component catalogue for the docs surfaces: which components exist,
 * and what one declares once its source has been read.
 *
 * The list is the components' tags table, which the caller hands in, so asking
 * for it costs nothing and needs no await. Every consumer here is the showcase,
 * its preview, the IDE sidebar or the theme editor.
 *
 * The tags table names each component's module (`<category>/<name>.js`), and
 * grouping by that folder is what the catalogue browses.
 *
 * Reading a component's files is the showcase controller's (`loadComponent`);
 * what it finds in them is described here.
 */

import type { ComponentDefinition } from "@lightstart/light";
import type { TypeDefinition } from "@lightstart/light/types";
import { extractDescription, extractParts, extractSlots } from "./example-parser.ts";
import type {
  ComponentDoc,
  ComponentList,
  ComponentMeta,
  ComponentPropertyMeta,
  ComponentTags,
  LoadedComponent,
  Renderable,
} from "./types.ts";

/**
 * Every showcase component, grouped by the directory it lives in.
 * @param tags the components' tag → path table
 * @returns component names grouped by the module's folder
 */
export function getComponentList(tags: ComponentTags): ComponentList {
  const grouped: ComponentList = {};
  for (const [tag, entry] of Object.entries(tags)) {
    const folder = String(String(entry.module).split("/").at(-2));
    (grouped[folder] ??= []).push(tag.replace(/^lc-/, ""));
  }
  return grouped;
}

/**
 * What a component tells the showcase about itself: its definition's metadata,
 * and the description, parts and slots its source's doc comment declares.
 */
export function describeComponent(
  componentDef: ComponentDefinition | undefined,
  name: string,
  sourceCode: string,
): LoadedComponent {
  return describeComponentDoc(componentDef, name, {
    description: extractDescription(sourceCode),
    parts: extractParts(sourceCode),
    slots: extractSlots(sourceCode),
  });
}

/**
 * What a component tells the showcase about itself, from a doc entry already
 * read off its source (the components' tags table carries it).
 */
export function describeComponentDoc(
  componentDef: ComponentDefinition | undefined,
  name: string,
  doc: ComponentDoc,
): LoadedComponent {
  return {
    ...extractMetadata(componentDef, name),
    ...doc,
  };
}

/** Extract metadata from a component definition. */
function extractMetadata(
  componentDef: ComponentDefinition | undefined,
  name: string,
): ComponentMeta {
  if (!componentDef) throw new Error("Invalid component definition");

  const properties: Record<string, ComponentPropertyMeta> = {};

  if (componentDef.props)
    for (const [key, typeDef] of Object.entries(componentDef.props))
      properties[key] = extractPropertyMetadata(typeDef as TypeDefinition);

  return {
    tag: componentDef.tag || `lc-${name}`,
    properties,
    hasStyle: componentDef.style === true,
    module: componentDef,
  };
}

/** Extract metadata from a property type definition. */
function extractPropertyMetadata(
  typeDef: TypeDefinition | string | number | boolean,
): ComponentPropertyMeta {
  if (
    typeof typeDef === "string" ||
    typeof typeDef === "number" ||
    typeof typeDef === "boolean"
  )
    return {
      type: typeof typeDef,
      defaultValue: typeDef,
    };

  if (typeDef && typeof typeDef === "object")
    return {
      type: typeDef.$type || "unknown",
      defaultValue: typeDef.defaultValue as Renderable,
      enum: typeDef.enum,
      required: typeDef.required || false,
      attribute: typeDef.attribute ?? true,
    };

  return {
    type: "unknown",
    defaultValue: undefined,
  };
}

/**
 * Get default values for all properties.
 * @param properties properties metadata
 * @returns default values
 */
export function getDefaultValues(
  properties: Record<string, ComponentPropertyMeta>,
): Record<string, Renderable> {
  const defaults: Record<string, Renderable> = {};

  for (const [key, metadata] of Object.entries(properties))
    if (metadata.defaultValue !== undefined) defaults[key] = metadata.defaultValue;

  return defaults;
}
