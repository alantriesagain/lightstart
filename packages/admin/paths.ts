/**
 * @file The path rules `@lightstart/admin` shares between the page and the dev
 * file API: a project-relative path with forward slashes, no `..`, no leading
 * slash, no backslash, no control characters, and no segment that is a dotfile
 * or one of `.git`, `node_modules`, `.light` and `.deployed`. The server adds
 * the folder and symlink checks on top.
 */

/** The folder names an admin path may never touch, whatever folder it is in. */
export const FORBIDDEN_SEGMENTS: readonly string[] = [".git", "node_modules", ".light", ".deployed"];

/** What is wrong with `path`, or null when it is a clean project-relative path. */
export const pathProblem = (path: string): string | null => {
  if (path === "") return "a path needs a name";
  if (path.startsWith("/")) return "a path is relative to the project, not absolute";
  if (path.includes("\\")) return "a path uses forward slashes";
  if (/[\u0000-\u001f\u007f]/.test(path)) return "a path carries a control character";
  const segments = path.split("/");
  for (const segment of segments) {
    if (segment === "") return "a path has no empty segment";
    if (segment === "." || segment === "..") return "a path does not walk with . or ..";
    if (segment.startsWith(".")) return `a path does not enter the dotfile "${segment}"`;
    if (FORBIDDEN_SEGMENTS.includes(segment)) return `a path does not enter "${segment}"`;
  }
  return null;
};

/** Throw for a bad path, naming what is wrong. */
export const assertPath = (path: string): void => {
  const problem = pathProblem(path);
  if (problem !== null) throw new Error(`The admin path "${path}" is not allowed: ${problem}`);
};

/** Whether `path` is `folder` itself or sits inside it. */
export const withinFolder = (path: string, folder: string): boolean => path === folder || path.startsWith(`${folder}/`);
