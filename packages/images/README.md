# @lightstart/images

Image variants made from a photo: a `_thumb` or `_card` sibling, the metadata of the bytes, and the URL that names each sibling. The same convention runs in node at build time, in a command, and in the browser before an upload.

## Variant paths

A variant is a sibling file whose suffix goes before the extension: `photo.jpg` → `photo_thumb.jpg`. Producers and consumers derive the URL instead of storing it.

```js
import { variantUrl, thumbUrl, isVariant } from "@lightstart/images";

variantUrl("/photos/foo.jpg", "thumb"); // "/photos/foo_thumb.jpg"
thumbUrl("/photos/foo.jpg");            // "/photos/foo_thumb.jpg"
isVariant("foo_thumb.jpg", "thumb");    // true
isVariant("foo.jpg", "thumb");          // false
```

An empty input, a path with no extension, or a dot that belongs to a directory answers `""`.

## Metadata

`imageSize(bytes)` reads JPEG, PNG or WebP dimensions from raw bytes; it touches no filesystem and runs in node or a page.

```js
import { imageSize } from "@lightstart/images";

imageSize(new Uint8Array(buffer)); // { type: "jpeg", width: 1100, height: 825 } | null
```

It answers `null` for an unrecognized format or a truncated header.

## Resize before upload (browser)

`resizeImage(file, options)` resizes a large picked image with `createImageBitmap` and a canvas (`OffscreenCanvas` when present). It leaves SVGs, GIFs, non-images and images already within bounds unchanged.

```js
import { resizeImage } from "@lightstart/images";

const upload = await resizeImage(file, { maxWidth: 1920, maxHeight: 1920, quality: 0.85, type: "image/webp" });
```

The result is a new `File` with the resized bytes and the matching extension.

## Normalize assets (node, `light images:normalize`)

`normalizeImages` caps every image in the configured dirs and writes its missing variants. It is idempotent: a metadata pre-scan finds the pending work first, and Chromium only launches when there is some.

```js
import { imagesConfig, normalizeImages } from "@lightstart/images";

await normalizeImages({ root, ...(await imagesConfig(root)) });
```

Configure it in the project's `package.json`:

```json
{
  "light": {
    "images": {
      "dirs": ["public/images", "content/photos"],
      "maxPx": 1280,
      "maxBytes": 307200,
      "quality": 0.8,
      "variants": [{ "suffix": "thumb", "width": 128, "height": 128, "fit": "cover", "quality": 0.78 }]
    }
  }
}
```

Every default is a field of `DEFAULTS`. A source is capped when its long edge is over `maxPx` or its bytes are over `maxBytes` (with a 1.25 tolerance); each variant is a resize of the source. A dry run lists the work without writing.

The command reads the same config:

```bash
light images:normalize
light images:normalize --dirs public/images,gallery --max-px 1600 --dry-run
```

## The node resize needs Playwright

There is no native dependency (no sharp): decoding and encoding run in headless Chromium through Playwright, imported lazily the first time a resize happens.

```bash
pnpm add -D playwright
pnpm exec playwright install chromium
```

If Playwright is missing, `createResizer()` (and so the command and `normalizeImages`) throws an error naming both install steps. The pure pieces (`variantUrl`, `thumbUrl`, `isVariant`, `imageSize`) and the browser `resizeImage` need nothing installed.

`createResizer()` boots one Chromium page for many `resize(bytes, ops)` calls; always `close()` it. Bytes go in, bytes come out.

## API

| Export | What it does |
|---|---|
| `variantUrl(src, suffix)` | The sibling URL with `_suffix` before the extension, or `""` |
| `thumbUrl(src)` | `variantUrl(src, "thumb")` |
| `isVariant(path, suffix)` | Whether a path already names that variant |
| `imageSize(bytes)` | `{ type, width, height }` for JPEG/PNG/WebP, else `null` |
| `resizeImage(file, options)` | A resized `File` for an upload (browser) |
| `createResizer()` | A node resize engine over headless Chromium |
| `DEFAULTS` | `dirs`, `maxPx`, `maxBytes`, `quality`, `variants` |
| `imagesConfig(projectDir)` | `light.images` merged over `DEFAULTS` |
| `scanPending(options)` | Sources that are oversized or miss a variant |
| `normalizeImages(options)` | Cap and write variants; answers `{ processed, pending? }` |
