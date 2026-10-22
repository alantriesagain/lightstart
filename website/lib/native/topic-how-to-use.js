/**
 * /native/how-to-use: running light's native tools: the scriptc they need,
 * the commands, writing native tests, and the rules light's native code
 * follows to compile statically. The commands are light's own (`package.json`
 * and `native/README.md`).
 */

const FORK_URL = "https://github.com/alantriesagain/scriptc/blob/light-integration/FORK.md";

/** @type {import("./topics.js").TopicPage} */
export default {
  title: "Using light natively",
  lede: "How to run light's native tools: the scriptc they need, the commands that build, test and check the native code, how a native test is written, and the rules the code follows so it compiles statically.",
  sections: [
    {
      id: "scriptc",
      title: "Setting up scriptc",
      blocks: [
        {
          kind: "text",
          text: `Light's native tools need scriptc with light's patches: the \`light-integration\` branch of the fork. Its [FORK.md](${FORK_URL}) lists the patches and how to build the fork, including the runtime pack and the LLVM helper it needs. Then point light's tools at it with the \`SCRIPTC\` environment variable:`,
        },
        { kind: "code", title: "shell", code: "SCRIPTC=/path/to/scriptc npm run verify", language: "text" },
        {
          kind: "text",
          text: "When `SCRIPTC` is not set, the tools use the scriptc in light's `node_modules`, then the one on `PATH`. scriptc caches builds by its version, not its source, so a patched scriptc should run with `SCRIPTC_NO_CACHE=1`; otherwise it can replay a binary an unpatched build of the same version produced.",
        },
      ],
    },
    {
      id: "commands",
      title: "Commands",
      blocks: [
        {
          kind: "table",
          columns: [
            { name: "command", label: "Command", code: true },
            { name: "does", label: "What it does" },
          ],
          rows: [
            { command: "npm run typecheck:native", does: "Type-checks the native code with tsc-ts against es2024, with Node's types and no DOM." },
            { command: "npm run coverage:native", does: "Runs scriptc coverage on native/tui/index.ts; fails on any statement that does not compile statically and on any slow path." },
            { command: "npm run coverage:tasks", does: "The same for the tasks example, whose JSDoc-typed JavaScript may compile partly dynamically." },
            { command: "npm run test:native", does: "Runs every native/*.test.js under Node and with scriptc run; both must exit zero and print the same output." },
            { command: "npm run probes", does: "Runs the compiler probes in native/probes/, one-file programs that test what scriptc accepts." },
            { command: "node native/tui/bench.js", does: "The benchmark on the How it works page, under Node; build it with scriptc to run it natively." },
            { command: "node native/tui/demo.js", does: "A demo screen: a counter button, a scrolling list and an editor, in the terminal." },
            { command: "native/tui/pty.sh", does: "Builds the demo natively and drives it in a pseudo-terminal: clicks, scrolling, Tab, Enter, submit." },
            { command: "node native/desktop/build.js run native/desktop/demo/backend.js", does: "Builds and opens the desktop shell's demo, a light page in the system web view." },
            { command: "npm run verify", does: "All of light's checks, the native and desktop ones included." },
          ],
        },
      ],
    },
    {
      id: "native-tests",
      title: "Writing a native test",
      blocks: [
        {
          kind: "text",
          text: "`node:test` is not available in scriptc, so a native test is a plain program. It imports the code it tests from `native/tui/index.ts` and the checks from `native/assert.js`: `ok`, `eq`, `eqn`, `throws` and `done`. Each check prints `ok name` or `FAIL name`, and `done()` ends the test with a non-zero exit code if any check failed. `npm run test:native` runs each test under Node and as an executable and compares the two outputs.",
        },
        {
          kind: "code",
          title: "A native test, shortened from native/tui/parts.test.js",
          language: "js",
          code: `import { TRoot, childNodes, dumpTree, render, textOf, TRun } from "./index.js";
import { done, eq, ok } from "./assert.js";

{
  const root = new TRoot();
  render("hello", root);
  eq("text dump", dumpTree(root, true), ["root", "  |", '  "hello"', "  |"].join("\\n"));
  const run = childNodes(root)[1];
  render("world", root);
  ok("same run node", childNodes(root)[1] === run && run instanceof TRun && run.text === "world");
  render(42, root);
  eq("number as text", textOf(root), "42");
}

done();`,
        },
      ],
    },
    {
      id: "rules",
      title: "Rules for native code",
      blocks: [
        {
          kind: "text",
          text: "The probes in `native/probes/` produced a short list of rules that light's shared code follows so that it compiles statically. From light's `native/README.md`:",
        },
        {
          kind: "list",
          items: [
            "Values are `unknown`, told apart with `typeof`, `instanceof` on module-level classes and `Array.isArray`.",
            "Identity lives in classes, never in interfaces.",
            "A generic class never extends a generic class.",
            "A function-typed field never shares its name with a method.",
            "A callback passed to a library method annotates its parameters.",
            "No `any`.",
            "A `Map` holds class instances, never functions.",
            "An empty array literal is typed where it is declared.",
          ],
        },
        {
          kind: "text",
          text: "Coverage shows whether new code follows them: run `npm run coverage:native` after a change. [Types and operations](/native/types) shows how each kind of value compiles, and [writing fast code](/native/performance) which changes make native code faster.",
        },
      ],
    },
  ],
};
