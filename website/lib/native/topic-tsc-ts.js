/**
 * /native/tsc-ts: TypeScript's compiler, ported from Go back to TypeScript and
 * compiled by scriptc: the three TypeScript compilers, their time and memory
 * checking light, tsc-ts as scriptc's checker, how tsc-ts is tested and its
 * use in light. The numbers are `measures.js`.
 */
import measures from "./measures.js";

const { typecheck } = measures;

/** @param {number | null} bytes */
const megabytes = (bytes) => (bytes === null ? "" : `${(bytes / 1e6).toFixed(1)} MB`);
/** @param {number} ms */
const seconds = (ms) => `${(ms / 1000).toFixed(2)} s`;

/** @param {string} id */
const checker = (id) => typecheck.checkers.find((entry) => entry.id === id);
const ts6 = checker("ts6");
const tsgo = checker("tsgo");
const tscTs = checker("tsc-ts");

/** @param {{ label: string, version: string } | undefined} entry */
const named = (entry) => (entry ? `${entry.label} ${entry.version}` : "");

const fastest = [...typecheck.checkers].sort((a, b) => a.ms - b.ms)[0];

/** @type {import("./topics.js").TopicPage} */
export default {
  title: "tsc-ts",
  lede: "tsc-ts is a port of the TypeScript 7.0.2 compiler from Go to TypeScript, compiled to a native executable with scriptc. Light uses it to type-check its code.",
  sections: [
    {
      id: "compilers",
      title: "TypeScript compilers",
      blocks: [
        {
          kind: "text",
          text: "Up to version 6, the TypeScript compiler is written in TypeScript and runs as JavaScript on Node. For version 7, Microsoft ported it to Go ([typescript-go](https://github.com/microsoft/typescript-go), or tsgo), which compiles to a native executable. [tsc-ts](https://github.com/vercel-labs/tsc-ts), a Vercel Labs experiment, ports tsgo back to TypeScript, and scriptc compiles that TypeScript to a native executable.",
        },
        {
          kind: "table",
          columns: [
            { name: "compiler", label: "Compiler" },
            { name: "written", label: "Written in" },
            { name: "runs", label: "Runs as" },
            { name: "version", label: "Measured here" },
          ],
          rows: [
            { compiler: "TypeScript 6 (tsc)", written: "TypeScript, compiled to JavaScript", runs: "JavaScript on Node", version: ts6?.version ?? "" },
            ...(tsgo ? [{ compiler: "tsgo (TypeScript 7)", written: "Go", runs: `a native executable, ${megabytes(tsgo.sizeBytes)}`, version: tsgo.version }] : []),
            { compiler: "tsc-ts", written: "TypeScript, ported from tsgo", runs: `a native executable compiled with scriptc, ${megabytes(tscTs?.sizeBytes ?? null)}`, version: `${tscTs?.version} (TypeScript 7.0.2)` },
          ],
        },
      ],
    },
    {
      id: "type-checking-light",
      title: "Type-checking light",
      blocks: [
        {
          kind: "text",
          text: `Each compiler type-checked light's whole project${typecheck.files ? ` (${typecheck.files} files)` : ""} with \`--noEmit\`, three times on the same machine. The table shows the fastest run of each.`,
        },
        { kind: "bars", title: "Time to type-check light, in milliseconds", data: typecheck.checkers.map((entry) => ({ label: named(entry), value: Math.round(entry.ms) })) },
        {
          kind: "table",
          columns: [
            { name: "compiler", label: "Compiler" },
            { name: "time", label: "Time" },
            { name: "memory", label: "Peak memory" },
            { name: "errors", label: "Errors found" },
          ],
          rows: typecheck.checkers.map((entry) => ({ compiler: named(entry), time: seconds(entry.ms), memory: megabytes(entry.rssKb * 1e3), errors: String(entry.errors) })),
        },
        typecheck.sameDiagnostics
          ? { kind: "note", variant: "tip", title: "Diagnostics", text: `All three printed the same diagnostics, byte for byte: the same ${tscTs?.errors} errors.` }
          : { kind: "note", variant: "warning", title: "Diagnostics", text: "The compilers' diagnostics differed on this run." },
        {
          kind: "text",
          text: `${named(fastest)} was the fastest on this run.${ts6 ? ` Compared with TypeScript 6 on Node, ${typecheck.checkers
            .filter((entry) => entry.id !== "ts6")
            .map((entry) => `${entry.label} was ${(ts6.ms / entry.ms).toFixed(1)} times faster`)
            .join(" and ")}.` : ""} These numbers are for one project on one machine. tsc-ts and tsgo both check files on several threads.`,
        },
      ],
    },
    {
      id: "scriptc-checker",
      title: "tsc-ts as scriptc's type checker",
      blocks: [
        {
          kind: "text",
          text: "scriptc does not have its own type checker. Its frontend sends queries to TypeScript 7's checker through the `tsc --api` server. tsc-ts implements the same server, and its tests compare each response with tsgo's. This means the checker scriptc uses can itself be a scriptc executable; the tsc-ts README states that scriptc builds the same programs with either.",
        },
        {
          kind: "flow",
          phases: ["Source", "Compiled by", "Result"],
          lanes: [
            {
              id: "tsc-ts",
              label: "tsc-ts",
              detail: "the compiler",
              steps: [
                { id: "tsc-ts-source", label: "tsc-ts's source", detail: "TypeScript", phase: 0 },
                { id: "tsc-ts-scriptc", label: "scriptc", phase: 1 },
                { id: "tsc-ts-binary", label: "tsc-ts", detail: "native, serves tsc --api", phase: 2, tone: "accent" },
              ],
            },
            {
              id: "program",
              label: "A program",
              detail: "for example counter.ts",
              steps: [
                { id: "program-source", label: "counter.ts", detail: "TypeScript", phase: 0 },
                { id: "program-scriptc", label: "scriptc", detail: "asks tsc --api: tsgo or tsc-ts", phase: 1, tone: "accent" },
                { id: "program-binary", label: "counter", detail: "native", phase: 2 },
              ],
            },
          ],
        },
        { kind: "note", text: "The builds on these pages used tsgo. scriptc runs TypeScript 7's own executable and has no option to use a different one, so the setup in the diagram is what tsc-ts's tests do, and an ordinary scriptc build does not." },
      ],
    },
    {
      id: "compatibility",
      title: "Compatibility testing",
      blocks: [
        {
          kind: "text",
          text: "tsc-ts compares each part of the compiler with tsgo on TypeScript's own test corpus, about 12,500 files (17,000 units after splitting multi-file cases): the scanner, parser, binder, module resolution, `tsconfig.json` and program construction, the command line, the diagnostics catalog, JavaScript and declaration emit, `--build` and `--incremental`, and the checker. [Its README](https://github.com/vercel-labs/tsc-ts#compiler) reports that every part matches.",
        },
      ],
    },
    {
      id: "in-light",
      title: "Use in light",
      blocks: [
        {
          kind: "list",
          items: [
            "`npm run typecheck` is `tsc-ts --noEmit`, over the whole package.",
            "`npm run typecheck:native` checks the native graph (the code scriptc compiles) against es2024 with Node's types and no DOM.",
            "The bootstrapp monorepo's `typecheck` uses tsc-ts as its checker and keeps TypeScript 6 as the library its tools import.",
          ],
        },
      ],
    },
  ],
};
