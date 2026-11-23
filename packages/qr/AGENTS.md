# Working on @lightstart/qr

What the package is and how to use it: [README.md](README.md). This file is what a change to it has to keep.

## Layout

| Where | What |
|---|---|
| `index.ts` | The typed public surface: the encoder, the reader, the renderers and the types |
| `types.ts` | The public types: `QrLevel`, `QrMatrix`, `QrOptions`, `QrImage`, `QrPoint`, `QrHomography`, `SvgOptions`, `TerminalOptions` |
| `encode.js` | `encode` and the standard's tables: capacity, blocks, Reed-Solomon, alignment, format and version information, mask penalties |
| `decode.js` | `decodeQr`, `readMatrix`, `perspective`, `correctBlock`: finders, homography, binarization, Reed-Solomon correction and segment parsing |
| `svg.js` | `toPath`, `toSvg`, `toDataUrl` |
| `terminal.js` | `toTerminal` |
| `views/code.js` | `<qr-code>`: its properties, its memoized encoding and its inline SVG |
| `tags.json` | The package's tag table, named by `package.json`'s `light.tags` |
| `locales/{en,es,pt}.js` | The words the view draws, under `qr-code` |
| `test/` | Plain node scripts on `@lightstart/test/assert.ts` and one Chromium test |

## The language choice

The algorithm modules stay JavaScript with JSDoc types, as light's framework-free modules are. `index.ts` and `types.ts` are TypeScript, as every package entry in light is. Tests that run under node are `.ts` plain scripts so `light test` finds them; the Chromium test is `.js` on `node:test`, as light's component browser tests are.

## Rules the sources keep

- No `any`, in TypeScript or JSDoc. Narrow `unknown` with `typeof`, `instanceof` or `Array.isArray`.
- Comments are a module header and doc comments on exported symbols, nothing else.
- The algorithm modules are pure: no `$APP`, no DOM, no imports beyond each other. `encode.js` holds the tables; `decode.js` runs the encoder backwards.
- The view module default-exports `defineComponent({ tag: "qr-code", ... })`; the generation defines the tag from `tags.json` when a view writes `<qr-code>`, so the module never registers itself.
- The view memoizes the encoded matrix on `value` and `level`, so a render for another reason does not re-encode.
- Words go through `lcText` from `@lightstart/components/utils/text.js`, with the English fallback in `locales/en.js`.
- The package ships its sources and needs no build step.

## Contracts others depend on

| Contract | Who relies on it |
|---|---|
| `encode(text, { level, mask })` and the `QrMatrix` shape | an app drawing its own symbol and the view |
| `decodeQr(image)` and `readMatrix(modules, size)` | an app reading a camera frame or a sampled grid |
| `perspective(from, to)`, `toPath`, `toSvg`, `toDataUrl`, `toTerminal` | an app rendering or testing a symbol |
| `tags.json`, `<qr-code>` and its attributes | the web generation and an app's views |
| The `qr-code.label` locales | a page running `@lightstart/i18n` |

## Gates

From the repository root:

```bash
light check --all
light typecheck @lightstart/qr
light test @lightstart/qr
npx eslint packages/qr
# from packages/qr, one browser file per run:
light test test/code.browser.test.js
```
