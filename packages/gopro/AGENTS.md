# Working on @lightstart/gopro

What the package is and how to use it: [README.md](README.md). This file is what a change to it has to keep.

## Layout

| Where | What |
|---|---|
| `index.ts` | The typed public surface: the driver and the pure protocol modules |
| `types.ts` | The preset and media-list reply shapes |
| `driver.js` | `goproDriver`: matching, `connect`, the session over a `Transport` |
| `lib/constants.js` | Service and characteristic UUIDs, command and status ids, URLs |
| `lib/protocol.js` | Framing, reassembly, status and capability parsing, command builders |
| `lib/settings.js` | Our names for the camera's numeric settings, crossed with what it reports |
| `lib/presets.js` | The camera's named presets and their labels |
| `lib/media.js` | The media list, URLs, filters and byte formatting |
| `test/` | Plain node scripts on `@lightstart/test/assert.ts` |

## Rules the sources keep

- Pure: the driver imports `@lightstart/devices` for types only; the `lib/` modules import nothing beyond each other. There is no shell and no DOM.
- The driver registers explicitly. The package never calls `registerDriver` on import; an app does, as the README shows. There is no frontend boot.
- No `any`, in TypeScript or JSDoc. Narrow `unknown` with `typeof`, `instanceof` or `Array.isArray`.
- Comments are a module header and doc comments on exported symbols, nothing else.
- Availability comes off the wire: a setting the camera reports no options for is dropped rather than guessed from the names table.
- The access point is reference-counted with `holds`; every path that joins also leaves.

## Contracts others depend on

| Contract | Who relies on it |
|---|---|
| `goproDriver` (default, `driver`, `goproDriver`) and its `connect` | an app's `registerDriver`, and `@lightstart/devices` |
| `DriverSession` methods and events | the `devices` controller and its views |
| `parseMediaList`, `downloadUrl`, `sinceFilter`, `formatBytes` | an app importing clips itself |
| The protocol builders and parsers | tests and a driver reusing the framing |

## Gates

From the repository root:

```bash
light check --all
light typecheck @lightstart/gopro
light test @lightstart/gopro
npx eslint packages/gopro
```
