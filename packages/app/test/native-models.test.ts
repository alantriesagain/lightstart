// node-only
/**
 * @file The mapping from a model's schema to `.light/models.ts`: each kind, and
 * required, default and optional fields, on their own.
 */

import { done, ok } from "@lightstart/test/assert.ts";
import { classNameOf, modelsSource } from "../tui/models.ts";

const source = modelsSource([
  {
    name: "item",
    schema: {
      id: { $type: "number" },
      title: { $type: "string", required: true },
      done: { $type: "boolean", defaultValue: false },
      note: { $type: "string" },
      tag: { $type: "string", defaultValue: "x" },
      flags: { $type: "array", defaultValue: [] },
      meta: { $type: "object", defaultValue: {} },
      anything: { $type: "function" },
    },
  },
]);

ok("the file says it is generated", source.startsWith("/**\n * @file The row classes of the app's models"));
ok("the file name becomes the class name", classNameOf("item") === "ItemRow" && source.includes("export class ItemRow {"));
ok("a number id is required and checked", source.includes("  id: number;") && source.includes('if (typeof id !== "number") return null;'));
ok("a required string is non-null and checked", source.includes("  title: string;") && source.includes('if (typeof title !== "string") return null;'));
ok("a boolean with a default reads the default", source.includes("  done: boolean;") && source.includes("let doneValue: boolean = false;"));
ok("an optional string is nullable and absent reads null", source.includes("  note: string | null;") && source.includes("let noteValue: string | null = null;"));
ok("a string default is a literal", source.includes('let tagValue: string = "x";'));
ok("an empty array default is a fresh empty array", source.includes("  flags: unknown[];") && source.includes("let flagsValue: unknown[] = [];") && source.includes("if (!Array.isArray(flags)) return null;"));
ok("an empty object default is a fresh empty object", source.includes("  meta: Record<string, unknown>;") && source.includes("let metaValue: Record<string, unknown> = {};") && source.includes('if (typeof meta !== "object" || meta === null || Array.isArray(meta)) return null;'));
ok("an unknown kind is unknown and unchecked", source.includes("  anything: unknown | null;") && !source.includes("typeof anything") && !source.includes("Array.isArray(anything)"));
ok("a wrong type answers null", source.includes('if (typeof done !== "boolean") return null;'));

done();
