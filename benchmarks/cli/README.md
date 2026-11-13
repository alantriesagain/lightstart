# CLI benchmark

How `@lightstart/cli` pays for its own startup under node and as a scriptc native binary. The same small program (`packages/cli/native/light.ts`: the core with a static command table, no discovery) runs two ways:

| Variant | What it is |
|---|---|
| node | `node packages/cli/native/light.ts <args>`, the program with node stripping the types |
| native | `packages/cli/dist/light <args>`, built by `node packages/native/cli/bin/light-native.js build @lightstart/cli` |

The real node CLI is a reference row: `node packages/cli/bin/light.js --help` also discovers light's commands (`test`, `check`, `serve`, `desktop`, `classes:bake`) from `packages/light/cli/commands`, which the native program does not.

```bash
node benchmarks/cli/run.js                  # build, then 30 interleaved runs per variant
node benchmarks/cli/run.js --runs 100       # more runs
node benchmarks/cli/run.js --no-build       # reuse packages/cli/dist/light
node benchmarks/cli/run.js --json out.json  # save the results
```

Each process is timed from spawn to exit with `process.hrtime.bigint()` around `spawnSync`. Every case runs once to warm up, then `--runs` times, interleaved node/native. Node's and native's stdout must be byte-identical per case, or the run fails. The report gives each variant's minimum and median of the runs and the ratio of their medians; a ratio above 1 means node took longer. The native build's own time is measured (and only then printed) when the script builds, and the binary's size is printed either way.

## Results

Linux x86_64, node v25.3.0, scriptc v0.4.12, load average 2.25 before the run and 2.11 after, 30 runs per variant, medians over milliseconds from spawn to exit:

| Case | node min | node median | native min | native median | node/native |
|---|---:|---:|---:|---:|---:|
| `--help` | 84.3 | 89.9 | 1.8 | 1.9 | 47.65 |
| `--version` | 77.3 | 85.5 | 1.8 | 1.9 | 45.88 |
| `version` | 79.9 | 85.8 | 1.8 | 2.0 | 42.64 |
| `echo -u -m json a b c` | 94.2 | 101.5 | 2.3 | 2.5 | 40.26 |
| `echo 200 words` | 93.9 | 98.3 | 2.3 | 2.6 | 38.25 |
| `discovery --help` | 113.0 | 119.4 | - | - | - |

The native binary is 1.25 MB and the build took 1.36 s (scriptc's cache makes repeat builds much faster).

The node figures are almost all node's own startup; the work the CLI does is a fraction of a millisecond. Read the ratios, not the absolute milliseconds: on a shared machine they move with the load average and with whatever else is starting processes, and warm-up and background activity shift medians by tens of percent. Discovery adds about a quarter to node's startup for `--help` here, as it imports and scans light's command folders.
