# Working on @lightstart/images

What the package is and how to use it: [README.md](README.md). This file is what a change to it has to keep.

## Layout

| Where | What |
|---|---|
| `index.ts` | The public surface a page and a Worker share: no `fs`, no Playwright |
| `node.ts` | `@lightstart/images/node`: the resize engine and the normalize step |
| `types.ts` | `ResizeOp`, `ImageVariant`, `ImagesConfig`, `ResizeResult`, `Resizer` |
| `paths.js` | `variantUrl`, `thumbUrl`, `isVariant` |
| `metadata.js` | `imageSize`: JPEG SOF, PNG IHDR, WebP VP8/VP8L/VP8X |
| `browser.js` | `resizeImage`: canvas/`OffscreenCanvas` before an upload |
| `resize.js` | `createResizer`: headless Chromium through Playwright |
| `normalize.js` | `DEFAULTS`, `imagesConfig`, `scanPending`, `normalizeImages` |
| `cli/commands/images/normalize.ts` | `light images:normalize` |
| `test/` | `paths.test.ts`, `metadata.test.ts` |

## Rules the sources keep

- A variant's name is derived from its source by `paths.js`; never store a `_thumb` URL beside the photo.
- `metadata.js` and `paths.js` take bytes and strings only: no `fs`, no DOM, so node and a page share them.
- The node resize has no native dependency. It decodes and encodes in headless Chromium through Playwright, imported lazily; a missing Playwright is an error naming `pnpm add -D playwright` and `pnpm exec playwright install chromium`.
- `normalizeImages` is idempotent: `scanPending` decides the work, an already-present variant is skipped, and a cap that would not shrink a file by `MIN_SHRINK` is not written.
- The config is `package.json → light.images`, merged over `DEFAULTS`; the command reads the same config as `normalizeImages`.
- A variant is never a source: a name `isVariant` matches is left out of the scan.
- TypeScript with erasable syntax; browser modules are JS with JSDoc. No `any`. Comments are a JSDoc module header and JSDoc on exports.

## Contracts others depend on

| Contract | Who relies on it |
|---|---|
| The `_suffix` before the extension convention | upload paths, cards, pins, meta tags |
| `variantUrl`, `thumbUrl`, `isVariant`, `imageSize` | an app's views and build scripts |
| `light.images` (`dirs`, `maxPx`, `maxBytes`, `quality`, `variants`) | a project's package.json |
| `light images:normalize` and its options | an app's build or publish script |
| `normalizeImages`, `imagesConfig` | a script normalizing a content drop |

## Gates

From the repository root:

```bash
light typecheck @lightstart/images
light test @lightstart/images
```
