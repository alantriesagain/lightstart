# Benchmarks

A/B harness for the view engine and the renderer. Each page loads the package as `scripts/pack.js` stages it, unbundled, through an importmap built from its exports, and exposes its steps to a Playwright runner. Run from the package folder:

```bash
node benchmarks/run.js                       # every page, 7 runs each
node benchmarks/run.js --pages cascade,reflect --runs 3
node benchmarks/run.js --json before.json    # save the medians
node benchmarks/run.js --compare before.json # print the change per step
node benchmarks/serve.js                     # serve the pages to open by hand
```

Each run opens a fresh page. For every step the runner records:

| Column | Meaning |
|---|---|
| `wall` | From the start of the step to the end of its last render, measured in the page. A step that waits for a frame includes that wait. |
| `cpu` | Main-thread task time during the step, from the DevTools `Performance` metrics. Independent of frame alignment. |
| `layout` | Style recalculation plus layout, part of `cpu`. |
| `other` | `cpu` minus `layout`: script, garbage collection and the rest. |

The table shows the median of the runs.

Run comparisons from a copy of the package outside any folder an editor watches (a git worktree under `/tmp`, say): staging rewrites `dist/`, and an editor's file watcher and language server reacting to that run on the same machine as the browser and skew every step by a quarter or more.

## Pages

| Page | What it measures |
|---|---|
| `rows-view` | js-framework-benchmark operations through one view component rendering keyed template rows |
| `rows-components` | The same operations with one custom element per row |
| `rows-html` | The same operations through the renderer alone |
| `rows-thunks` | The renderer alone, with each label in a signal and selection through `selector()` |
| `rows-lit` | lit-html 3 from esm.sh, as a reference for the renderer; needs network |
| `cascade` | Mount and update of a chain of nested components, depth 5, 20 and 50 |
| `reflect` | Connecting and updating 2,000 components with six string and boolean props, reflecting and with `attribute: false` |

Labels come from a seeded generator, so every run and every page draws the same rows. To compare two versions of the code, run one from a git worktree of the old commit with `--json`, then run the current tree with `--compare`.
