import { defineRule } from "../define.js";
import { stripCssComments } from "../strip-comments.js";

/** @param {string} css */
const topLevelSelectors = (css) => {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === "{") {
      if (depth === 0) out.push({ selector: css.slice(start, i).trim(), offset: start, body: "", bodyStart: i + 1 });
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        start = i + 1;
        const last = out[out.length - 1];
        if (last) last.body = css.slice(last.bodyStart, i);
      }
    } else if (ch === ";" && depth === 0) start = i + 1;
  }
  return out.filter((s) => s.selector);
};

/**
 * Whether every rule nested in an ancestor block names the component's tag,
 * as in `:where(.lc-join) { > lc-stat { ... } }`.
 * @param {string} body
 * @param {RegExp} ownTag
 */
const nestedSelectorsNameTag = (body, ownTag) => {
  const nested = topLevelSelectors(body).filter((s) => !s.selector.startsWith("@"));
  return nested.length > 0 && nested.every((s) => ownTag.test(s.selector));
};

/** @param {string[]} tags */
const namesTag = (tags) => new RegExp(`(^|[^\\w-])(?:${tags.map((tag) => tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![\\w-])`);

export default defineRule({
  severity: "warn",
  description: "Component CSS must scope every top-level selector through the component's own tag, as the tag or :where(.tag, tag)",
  why: "component css loads into the light DOM, so an unscoped selector styles the whole app. Applies regardless of the project's styling flavor: any style: true css file is document-level. The scope names the view's own tag: a :where() naming another tag (a stale prefix left by a rename or a move between units) styles nothing of this component and leaks onto whatever carries that other tag",
  check(ctx) {
    const files = new Set(ctx.files());
    for (const file of ctx.componentFiles()) {
      if (!/\.(js|ts)$/.test(file)) continue;
      const tags = ctx.viewsIn(file).flatMap((view) => (view.isComponent && view.styleTrue && view.tag ? [view.tag] : []));
      if (!tags.length) continue;
      const cssFile = file.replace(/\.(js|ts)$/, ".css");
      if (!files.has(cssFile)) continue;
      const css = stripCssComments(ctx.read(cssFile) || "");
      const ownTag = namesTag(tags);
      for (const { selector, offset, body } of topLevelSelectors(css)) {
        if (selector.startsWith("@") || selector.startsWith(":root") || selector.startsWith("::view-transition")) continue;
        if (selector.includes(":where(") ? ownTag.test(selector) : tags.some((tag) => selector.includes(tag))) continue;
        if (selector.startsWith(":where(") && body.includes("{") && nestedSelectorsNameTag(body, ownTag)) continue;
        const fix = `scope as :where(.${tags[0]}, ${tags[0]}) ...`;
        const head = selector.split(",")[0].trim();
        ctx.report({
          file: cssFile,
          offset,
          message: selector.includes(":where(")
            ? `top-level selector "${head}" is scoped to another tag, not <${tags[0]}>; ${fix}`
            : `top-level selector "${head}" leaks into the light DOM; ${fix}`,
        });
      }
    }
  },
});
