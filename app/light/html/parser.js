import { HTML_KIND, MARKER_END, MARKER_START } from "./constants.js";

                                                                    

const TEXT = 0;
const TAG_OPEN = 1;
const TAG_BODY = 2;
const ATTR_NAME = 3;
const ATTR_EQ = 4;
const ATTR_VALUE_DQ = 5;
const ATTR_VALUE_SQ = 6;
const ATTR_VALUE_UNQ = 7;
const COMMENT = 8;
const RAWTEXT = 9;
const CLOSE_TAG = 10;

const HTML_RAW_TAGS = new Set(["script", "style", "textarea", "title"]);
const SVG_RAW_TAGS = new Set(["script", "style"]);
const CHILD_MARKER = `<!--${MARKER_START}--><!--${MARKER_END}-->`;
const ELEMENT_MARKER = "data-$$";

const isWS = (c        ) => c === " " || c === "\t" || c === "\n" || c === "\r" || c === "\f";

/**
 * Parse the static quasis of an html``/svg`` template into markup with
 * binding markers plus an ordered part list. Child bindings become a
 * `<!--$--><!--/-->` comment pair; elements with bound attributes get a
 * `data-$$` marker attribute and their bound attributes are withheld from
 * the markup entirely (committed via parts at instantiation). A `<slot>`
 * is marked too and listed as a `slot` part, so the instance that clones
 * the template can hand it to its host for light-DOM projection.
 */
export const parseTemplate = (strings                       , kind        )              => {
  const rawTags = kind === HTML_KIND ? HTML_RAW_TAGS : SVG_RAW_TAGS;
  const parts               = [];
  let out = "";
  let state = TEXT;
  let tagName = "";
  let closing = false;
  let attr                                                                                       = null;
  let marked = false;
  let markedOrd = -1;
  let markedCount = 0;
  let childCount = 0;
  let beforeGt = -1;
  let lastMarked = false;
  let lastOrd = -1;
  let rawTag = "";
  let rawContentSeen = false;
  let rawPending = false;

  const err = (msg        , qi        ) => {
    throw new Error(`[light/html] ${msg} (expression ${qi} of \`${strings.join("${…}").slice(0, 120)}\`)`);
  };

  const finishAttr = (quote        ) => {
    const a = attr                            ;
    if (a.statics === null) out += ` ${a.name}=${quote}${a.value}${quote}`;
    else {
      a.statics.push(a.value);
      let partKind           = "attr";
      let name = a.name;
      const prefix = name[0];
      if (prefix === ".") {
        partKind = "prop";
        name = name.slice(1);
      } else if (prefix === "?") {
        partKind = "bool";
        name = name.slice(1);
      } else if (prefix === "@") {
        partKind = "event";
        name = name.slice(1);
      }
      const valueCount = a.statics.length - 1;
      if (partKind !== "attr" && valueCount > 1)
        err(`"${a.name}" supports a single binding, got ${valueCount}`, a.valueIndex);
      if (!marked) {
        marked = true;
        markedOrd = markedCount++;
      }
      parts.push({ kind: partKind, name, statics: a.statics, elOrd: markedOrd, valueIndex: a.valueIndex, valueCount });
    }
    attr = null;
    state = TAG_BODY;
  };

  const closeOpenTag = (selfClosing         ) => {
    if (tagName === "slot") {
      if (!marked) {
        marked = true;
        markedOrd = markedCount++;
      }
      parts.push({ kind: "slot", elOrd: markedOrd, valueIndex: -1, valueCount: 0 });
    }
    if (marked) out += ` ${ELEMENT_MARKER}`;
    beforeGt = out.length;
    out += selfClosing ? "/>" : ">";
    lastMarked = marked;
    lastOrd = markedOrd;
    marked = false;
    markedOrd = -1;
    if (!selfClosing && !closing && rawTags.has(tagName)) {
      state = RAWTEXT;
      rawTag = tagName;
      rawContentSeen = false;
      rawPending = false;
    } else state = TEXT;
  };

  const handleBoundary = (qi        ) => {
    switch (state) {
      case TEXT:
        out += CHILD_MARKER;
        parts.push({ kind: "child", childOrd: childCount++, valueIndex: qi, valueCount: 1 });
        return;
      case RAWTEXT: {
        if (rawContentSeen || rawPending)
          err(`a binding inside <${rawTag}> must be the element's entire content`, qi);
        if (!lastMarked) {
          out = `${out.slice(0, beforeGt)} ${ELEMENT_MARKER}${out.slice(beforeGt)}`;
          lastMarked = true;
          lastOrd = markedCount++;
        }
        parts.push({ kind: "rawtext", name: rawTag, elOrd: lastOrd, valueIndex: qi, valueCount: 1 });
        rawPending = true;
        return;
      }
      case ATTR_EQ: {
        const a = attr                            ;
        a.statics = [a.value];
        a.valueIndex = qi;
        a.value = "";
        state = ATTR_VALUE_UNQ;
        return;
      }
      case ATTR_VALUE_UNQ:
      case ATTR_VALUE_DQ:
      case ATTR_VALUE_SQ: {
        const a = attr                            ;
        if (a.statics === null) {
          a.statics = [a.value];
          a.valueIndex = qi;
        } else a.statics.push(a.value);
        a.value = "";
        return;
      }
      case TAG_OPEN:
        err("dynamic tag names are not supported; use element(tag, bindings, children)", qi);
        return;
      case TAG_BODY:
        err("element-position bindings are not supported; use element(tag, bindings, children)", qi);
        return;
      case ATTR_NAME:
        err("attribute-name bindings are not supported", qi);
        return;
      case COMMENT:
        err("bindings inside comments are not supported", qi);
        return;
      case CLOSE_TAG:
        err("bindings inside closing tags are not supported", qi);
    }
  };

  for (let qi = 0; qi < strings.length; qi++) {
    const q = strings[qi];
    let i = 0;
    if (state === RAWTEXT && rawPending) {
      if (!new RegExp(`^\\s*</${rawTag}`, "i").test(q))
        err(`a binding inside <${rawTag}> must be the element's entire content`, qi - 1);
      rawPending = false;
    }
    while (i < q.length) {
      const c = q[i];
      switch (state) {
        case TEXT: {
          if (c === "<") {
            if (q.startsWith("<!--", i)) {
              out += "<!--";
              i += 4;
              state = COMMENT;
              continue;
            }
            closing = q[i + 1] === "/";
            out += closing ? "</" : "<";
            i += closing ? 2 : 1;
            tagName = "";
            state = TAG_OPEN;
            continue;
          }
          out += c;
          i++;
          continue;
        }
        case COMMENT: {
          const end = q.indexOf("-->", i);
          if (end === -1) {
            out += q.slice(i);
            i = q.length;
          } else {
            out += q.slice(i, end + 3);
            i = end + 3;
            state = TEXT;
          }
          continue;
        }
        case TAG_OPEN: {
          if (isWS(c) || c === ">" || c === "/") {
            state = closing ? CLOSE_TAG : TAG_BODY;
            continue;
          }
          tagName += c.toLowerCase();
          out += c;
          i++;
          continue;
        }
        case CLOSE_TAG: {
          out += c;
          i++;
          if (c === ">") state = TEXT;
          continue;
        }
        case TAG_BODY: {
          if (isWS(c)) {
            out += c;
            i++;
            continue;
          }
          if (c === ">") {
            closeOpenTag(false);
            i++;
            continue;
          }
          if (c === "/" && q[i + 1] === ">") {
            closeOpenTag(true);
            i += 2;
            continue;
          }
          attr = { name: c, statics: null, value: "", valueIndex: -1 };
          state = ATTR_NAME;
          i++;
          continue;
        }
        case ATTR_NAME: {
          const a = attr                            ;
          if (c === "=") {
            state = ATTR_EQ;
            i++;
            continue;
          }
          if (isWS(c) || c === ">" || c === "/") {
            out += ` ${a.name}`;
            attr = null;
            state = TAG_BODY;
            continue;
          }
          a.name += c;
          i++;
          continue;
        }
        case ATTR_EQ: {
          const a = attr                            ;
          if (isWS(c)) {
            i++;
            continue;
          }
          if (c === '"') {
            state = ATTR_VALUE_DQ;
            i++;
            continue;
          }
          if (c === "'") {
            state = ATTR_VALUE_SQ;
            i++;
            continue;
          }
          if (c === ">") {
            out += ` ${a.name}=""`;
            attr = null;
            state = TAG_BODY;
            continue;
          }
          a.value = "";
          state = ATTR_VALUE_UNQ;
          continue;
        }
        case ATTR_VALUE_DQ: {
          if (c === '"') {
            finishAttr('"');
            i++;
            continue;
          }
          const a = attr                            ;
          a.value += c;
          i++;
          continue;
        }
        case ATTR_VALUE_SQ: {
          if (c === "'") {
            finishAttr("'");
            i++;
            continue;
          }
          const a = attr                            ;
          a.value += c;
          i++;
          continue;
        }
        case ATTR_VALUE_UNQ: {
          if (isWS(c) || c === ">" || (c === "/" && q[i + 1] === ">")) {
            finishAttr('"');
            continue;
          }
          const a = attr                            ;
          a.value += c;
          i++;
          continue;
        }
        case RAWTEXT: {
          const closeIdx = q.toLowerCase().indexOf(`</${rawTag}`, i);
          if (closeIdx === -1) {
            if (i < q.length) rawContentSeen = true;
            out += q.slice(i);
            i = q.length;
            continue;
          }
          if (closeIdx > i) rawContentSeen = true;
          out += q.slice(i, closeIdx);
          out += "</";
          i = closeIdx + 2;
          closing = true;
          tagName = "";
          state = TAG_OPEN;
          continue;
        }
      }
    }
    if (qi < strings.length - 1) handleBoundary(qi);
  }

  return { markup: out, parts };
};
