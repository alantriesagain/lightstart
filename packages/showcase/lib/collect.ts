/// <reference lib="dom" />
import type { ComponentDefinition } from "@lightstart/light";

/**
 * The theme tokens read by the components a set of descriptors places, merged
 * by category, for a page builder that themes what it placed.
 */
export async function collectThemeTokens(
  descriptors: unknown[],
  loadDefinition: (tag: string) => Promise<ComponentDefinition | null>,
): Promise<Record<string, string[]>> {
  const tags = [
    ...new Set(
      (descriptors || [])
        .map((d) => (typeof d === "object" && d !== null ? (d as { type?: unknown }).type : undefined))
        .filter((t): t is string => typeof t === "string" && t.includes("-")),
    ),
  ];

  const defs = await Promise.all(
    tags.map((tag) => loadDefinition(tag).catch(() => null)),
  );

  const merged: Record<string, string[]> = {};
  for (const def of defs) {
    const tokens = def?.themeTokens;
    if (!tokens) continue;
    for (const [cat, keys] of Object.entries(tokens)) {
      if (!Array.isArray(keys)) continue;
      const names = keys.filter((key): key is string => typeof key === "string");
      merged[cat] = [...new Set([...(merged[cat] || []), ...names])];
    }
  }
  return merged;
}
