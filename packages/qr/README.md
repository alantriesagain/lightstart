# @lightstart/qr

A byte-mode QR encoder with an SVG renderer and a terminal renderer, and a reader that finds a QR code in a camera frame. No dependencies, no `$APP`, no DOM: the same module runs in the browser and under node.

```js
import { encode, toSvg, toDataUrl, toTerminal } from "@lightstart/qr";

const matrix = encode("https://example.com/#peer=...", { level: "M" });
matrix.version;            // 1 to 40, the smallest that fits
matrix.size;               // 17 + 4 * version
matrix.modules[y * matrix.size + x];   // 1 for a dark module

toSvg(matrix, { margin: 1, size: 200 });   // one <path>, quiet zone in the viewBox, currentColor
toDataUrl(matrix);                          // data:image/svg+xml;utf8,... for an <img>
toTerminal(matrix);                         // half-block glyphs, two module rows per line
```

`encode(text, { level, mask })`: `level` is `L`, `M` (default), `Q`, or `H`; `mask` forces one of the eight masks instead of scoring them (tests use it). Text is UTF-8 encoded into one byte segment; it throws when the payload does not fit version 40 at the level.

What is a table and what is computed: the standard's total codewords per version and its error-correction codewords and block counts per version and level are tables (360 small integers). GF(256) over `0x11d`, the Reed-Solomon generator polynomials, alignment pattern positions, the format information (BCH `0x537`, masked `0x5412`), the version information (BCH `0x1F25`), and the mask penalties are computed.

## Reading one

```js
import { decodeQr, readMatrix } from "@lightstart/qr";

decodeQr(context.getImageData(0, 0, width, height));   // the text, or null
decodeQr({ data: luminance, width, height });           // one byte a pixel works too
readMatrix(matrix.modules, matrix.size);                // a grid already sampled
```

`decodeQr` binarizes the frame against each pixel's neighbourhood (and against one Otsu threshold when that finds nothing), finds the three finder patterns along the rows and checks each down its column, and takes the best right-angled triple. The grid size comes from the finder spacing, corrected for the symbol's angle. The fourth corner is the alignment pattern, searched between where a parallelogram and a perspective through the finders put it (the perspective reads how much closer each finder is from its module size), so a code held at a slant reads too. A mirrored symbol reads as well. `readMatrix` matches the format and version information to the nearest valid code, unmasks, de-interleaves and corrects every block (Berlekamp-Massey, Chien search, Forney), and decodes numeric, alphanumeric and byte segments (byte text as UTF-8). A frame of 640 by 480 takes about 10 ms.

## The terminal

```js
import { encode, toTerminal } from "@lightstart/qr";

console.log(toTerminal(encode("https://example.com"), { margin: 2 }));
```

Two module rows per line in `▀`, `▄`, `█` and space, with a quiet zone of `margin` modules (2 by default), dark on the terminal's foreground.

## `<qr-code>`

The package ships the tag in `tags.json`; a view that writes `<qr-code>` gets the module defined and needs no import. It draws one inline SVG path in `currentColor`, with a quiet zone of `margin` modules in the viewBox and crisp edges. The encoding is memoized on `value` and `level`.

```html
<qr-code value="https://example.com" size="200"></qr-code>
```

| Attribute | Default | What it is |
|---|---|---|
| `value` | `""` | The text to encode; empty draws nothing |
| `level` | `"M"` | Error-correction level: `L`, `M`, `Q` or `H` |
| `size` | `200` | SVG width and height in CSS pixels |
| `margin` | `1` | Quiet zone in modules |
| `label` | `""` | `aria-label`; the translated `qr-code.label` when absent |

The words `qr-code.label` ship in `locales/{en,es,pt}.js`, which the page merges when `@lightstart/i18n` is installed.

## Modules

| File | What it holds |
|---|---|
| `index.ts` | The public surface: `encode`, `decodeQr`, `readMatrix`, `perspective`, `toPath`, `toSvg`, `toDataUrl`, `toTerminal` and the types |
| `encode.js` | `encode` and the tables and arithmetic it builds on |
| `decode.js` | `decodeQr`, `readMatrix`, `perspective`, `correctBlock` |
| `svg.js` | `toPath`, `toSvg`, `toDataUrl` |
| `terminal.js` | `toTerminal` |
| `types.ts` | The public types |
| `views/code.js` | `<qr-code>` |
| `tags.json` | The package's tag table |

## Tests

`light test @lightstart/qr`: the encoder test carries its own reader (it walks the placement back out of the matrix, unmasks, de-interleaves the blocks, checks every block's Reed-Solomon syndromes, and recovers the payload), and checks the format and version information, version selection at the capacity edges, UTF-8, and all four levels. The svg and terminal tests check the renderers against a known symbol. The decoder test reads back the encoder's symbols at every level, through damaged modules, and drawn into frames turned, slanted, mirrored, noisy and unevenly lit. The view test runs in headless Chromium.
