/**
 * @bootstrapp/light/markup/serialize: a markup tree as the HTML a browser
 * would serialize it to, so a page served from it adopts cleanly in the
 * browser: the engine's marker comments stay in, text and attribute values
 * are escaped, void elements take no end tag, `<script>` and `<style>` keep
 * their text as is.
 */
import { MComment, MElement, MFragment, MNode, MRoot, MText } from "./node.js";

const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const RAW_TAGS = new Set(["script", "style"]);

/** @param {string} s */
const escapeText = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll(" ", "&nbsp;");

/** @param {string} s */
const escapeAttribute = (s) => s.replaceAll("&", "&amp;").replaceAll("\"", "&quot;").replaceAll(" ", "&nbsp;");

/**
 * @param {MNode} node
 * @param {boolean} comments whether comment nodes are written
 * @param {boolean} raw whether text is written unescaped
 * @returns {string}
 */
const write = (node, comments, raw) => {
  if (node instanceof MText) return raw ? node.data : escapeText(node.data);
  if (node instanceof MComment) return comments ? `<!--${node.data}-->` : "";
  if (!(node instanceof MElement)) return "";
  if (node instanceof MFragment || node instanceof MRoot) return writeChildren(node, comments, raw);
  let out = `<${node.tag}`;
  for (const [name, value] of node.attrs) out += value === "" ? ` ${name}=""` : ` ${name}="${escapeAttribute(value)}"`;
  out += ">";
  if (VOID_TAGS.has(node.tag)) return out;
  return `${out}${writeChildren(node, comments, RAW_TAGS.has(node.tag))}</${node.tag}>`;
};

/**
 * @param {MElement} node
 * @param {boolean} comments
 * @param {boolean} raw
 */
const writeChildren = (node, comments, raw) => {
  let out = "";
  for (const child of node.children) out += write(child, comments, raw);
  return out;
};

/**
 * The markup of `node` with every comment the engine left in, which a
 * browser adopts; of a root or fragment, the markup of its children.
 * @param {MNode} node
 */
export const serialize = (node) => write(node, true, false);

/**
 * The markup of `node` without its comments: what a reader compares.
 * @param {MNode} node
 */
export const markupOf = (node) => write(node, false, false);

/**
 * The text of every text node under `node`, in order.
 * @param {MNode} node
 * @returns {string}
 */
export const textContent = (node) => {
  if (node instanceof MText) return node.data;
  if (!(node instanceof MElement)) return "";
  let out = "";
  for (const child of node.children) out += textContent(child);
  return out;
};
