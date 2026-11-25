/**
 * @file The page's `next` check, the path-only mirror of
 * `@lightstart/server`'s `safeTarget`. A page navigates to
 * `safeNext(query.next)` after sign-in, so a target the request supplied
 * cannot leave the app.
 */

/**
 * `target` when it is a path on this app, else `/`. A path starts with one
 * `/`, has no second `/` or `\` after it, no backslash anywhere, and no
 * control character (below U+0020, or DEL) anywhere. Those refuse
 * `//evil.example`, `/\evil.example`, a tab or newline a browser would drop
 * into `//evil.example`, and an absolute URL, while keeping `/x?y#z` and `/`.
 */
export const safeNext = (target: string | null | undefined): string => {
  if (typeof target !== "string" || target === "" || target.charCodeAt(0) === 32) return "/";
  for (let i = 0; i < target.length; i++) {
    const code = target.charCodeAt(i);
    if (code < 32 || code === 127 || code === 92) return "/";
  }
  if (!target.startsWith("/") || target.startsWith("//")) return "/";
  return target;
};
