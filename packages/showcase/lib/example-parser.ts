/**
 * What a component's own doc comment still carries: the slots and parts it
 * exposes. Examples and the description live in its `<component>.demo.js`.
 */

import type { DocEntry } from "./types.ts";

/** Read the description a source's last doc comment carries above its tags. */
export function extractDescription(sourceCode: string): string {
  const matches = sourceCode.match(/\/\*\*([\s\S]*?)\*\//g);
  if (!matches || matches.length === 0) return "";

  const lastComment = matches[matches.length - 1];
  const docstring = lastComment.replace(/^\/\*\*/, "").replace(/\*\/$/, "");

  const lines = docstring.split("\n");
  const descLines: string[] = [];

  for (const line of lines) {
    const cleaned = line.replace(/^\s*\*\s?/, "").trim();

    if (cleaned.startsWith("@")) break;

    if (descLines.length === 0 && !cleaned) continue;

    descLines.push(cleaned);
  }

  return descLines.join("\n").trim();
}

/** Read every `@part` the source's last doc comment declares. */
export function extractParts(sourceCode: string): DocEntry[] {
  const matches = sourceCode.match(/\/\*\*([\s\S]*?)\*\//g);
  if (!matches || matches.length === 0) return [];

  const lastComment = matches[matches.length - 1];
  const docstring = lastComment.replace(/^\/\*\*/, "").replace(/\*\/$/, "");
  const parts: DocEntry[] = [];
  const partRegex = /@part\s+(\S+)\s+-\s+(.+?)(?=\n\s*[@*]|$)/gm;
  let match;

  while ((match = partRegex.exec(docstring)) !== null)
    parts.push({
      name: match[1].trim(),
      description: match[2].trim(),
    });

  return parts;
}

/** Read every `@slot` the source's last doc comment declares. */
export function extractSlots(sourceCode: string): DocEntry[] {
  const matches = sourceCode.match(/\/\*\*([\s\S]*?)\*\//g);
  if (!matches || matches.length === 0) return [];

  const lastComment = matches[matches.length - 1];
  const docstring = lastComment.replace(/^\/\*\*/, "").replace(/\*\/$/, "");
  const slots: DocEntry[] = [];
  const slotRegex = /@slot\s+([^\s-]*)\s*-?\s*(.*)$/gm;
  let match;

  while ((match = slotRegex.exec(docstring)) !== null) {
    const name = match[1].trim();
    const description = match[2].trim();

    slots.push({
      name: name || "default",
      description: description || "Default slot",
    });
  }

  return slots;
}
