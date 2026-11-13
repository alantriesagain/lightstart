# Build benchmark

How long `@lightstart/build`'s `build()` takes on the two examples, `examples/todomvc` and `examples/starter`. Each build runs into a fresh temporary output folder; the warm-up and the timed runs use the same example, and the temporary folder is removed after each run. Node only: esbuild does the bundling, and it is a node program.

```bash
node benchmarks/build/run.js                # warm-up, then 10 runs per example
node benchmarks/build/run.js --runs 30      # more runs
node benchmarks/build/run.js --json results.json
```

The report gives the minimum and median wall time around `build()` (not the temporary folder's creation or removal), the number of files the build wrote, and their total size.

## Results

Linux x86_64, node v25.3.0, 2026-11-13, 10 runs per example after a warm-up:

| Example | min ms | median ms | files | output bytes | output KB |
|---|---:|---:|---:|---:|---:|
| todomvc | 10 | 13 | 3 | 72706 | 71.0 |
| starter | 15 | 16 | 9 | 210639 | 205.7 |

Read the milliseconds as ratios: a warm build of either example is small enough that the filesystem and the scheduler shape the numbers more than the bundler does on a machine under load. Output bytes are the sum of the build report's files.
