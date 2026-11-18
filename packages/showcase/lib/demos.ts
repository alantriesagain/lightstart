/**
 * The code a component's demo shows under each example.
 *
 * One `<component>.demo.js` sits beside each component; the showcase controller
 * loads it (`loadDemo`). The snippet under an example is the example's own
 * source. `render` is a plain arrow returning one `html` template, so
 * `toString()` is the markup that produced what is on screen, and there is no
 * second copy to drift.
 */

export interface DemoExample {
  title: string;
  render: () => unknown;
}

const ARROW = /^\s*\(\s*\)\s*=>\s*/;

/**
 * The markup an example renders, read back off its own function.
 */
export const codeOf = (example: DemoExample): string => {
  const source = String(example.render).replace(ARROW, "").trim();
  const body = /^html`([\s\S]*)`$/.exec(source)?.[1];
  if (body === undefined) return source;
  const lines = body.replace(/^\n/, "").replace(/\s+$/, "").split("\n");
  const indent = Math.min(
    ...lines.filter((line) => line.trim()).map((line) => line.length - line.trimStart().length),
  );
  return lines.map((line) => line.slice(indent)).join("\n");
};
