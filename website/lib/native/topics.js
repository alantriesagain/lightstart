/**
 * The native section's topic pages by their route's `:topic` (the overview
 * and the comparison have views of their own), and the shape
 * of a page: a title, a lede and sections of blocks, which
 * `views/native-topic.js` draws. Each page's words are its own module.
 */
import howItWorks from "./topic-how-it-works.js";
import howToUse from "./topic-how-to-use.js";
import issues from "./topic-issues.js";
import concepts from "./topic-concepts.js";
import javascript from "./topic-javascript.js";
import scriptc from "./topic-scriptc.js";
import types from "./topic-types.js";
import performance from "./topic-performance.js";
import tscTs from "./topic-tsc-ts.js";

/** @import { FlowLane } from "@bootstrapp/light/components/types.ts" */

/**
 * @typedef {{ kind: "code", title: string, code: string, language: string, highlight?: string, foldAt?: number }} CodeBlock
 * @typedef {{ kind: "text", text: string }
 *   | { kind: "list", items: string[] }
 *   | CodeBlock
 *   | { kind: "compare", items: CodeBlock[] }
 *   | { kind: "table", columns: { name: string, label: string, code?: boolean }[], rows: Record<string, string>[] }
 *   | { kind: "stats", items: { title: string, value: string, desc?: string, variant?: string }[] }
 *   | { kind: "bars", title: string, data: { label: string, value: number }[] }
 *   | { kind: "note", text: string, title?: string, variant?: string }
 *   | { kind: "flow", lanes: FlowLane[], phases?: string[] }} Block
 * @typedef {{ id: string, title: string, blocks: Block[] }} Section
 * @typedef {{ title: string, lede: string, sections: Section[] }} TopicPage
 */

/** @type {Record<string, TopicPage>} */
export const TOPICS = { "how-it-works": howItWorks, "how-to-use": howToUse, issues, concepts, javascript, scriptc, types, performance, "tsc-ts": tscTs };
