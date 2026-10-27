/**
 * The block table behind windowed rendering: lines are grouped in blocks of
 * `blockSize`; a block's height is what was last measured, or an estimate
 * from the line height until it is. Offsets answer where a block sits and
 * which blocks a viewport needs.
 */

/** @import { BlockTable } from "./types.js" */

/**
 * @param {number} lineCount
 * @param {{ blockSize?: number, lineHeight?: number }} [options]
 * @returns {BlockTable}
 */
export const createBlockTable = (lineCount, { blockSize = 100, lineHeight = 20 } = {}) => {
  /** @type {Map<number, number>} */
  let measured = new Map();
  let lines = Math.max(1, lineCount);
  let estimate = lineHeight;

  const blockCount = () => Math.ceil(lines / blockSize);

  const linesOf = (/** @type {number} */ block) => ({
    first: block * blockSize + 1,
    last: Math.min(lines, (block + 1) * blockSize),
  });

  const heightOf = (/** @type {number} */ block) => {
    const m = measured.get(block);
    if (m !== undefined) return m;
    const { first, last } = linesOf(block);
    return (last - first + 1) * estimate;
  };

  const offsetOf = (/** @type {number} */ block) => {
    let y = 0;
    for (let i = 0; i < block; i++) y += heightOf(i);
    return y;
  };

  /** @type {BlockTable} */
  const table = {
    blockSize,
    get blockCount() {
      return blockCount();
    },
    get lineCount() {
      return lines;
    },
    linesOf,
    heightOf,
    offsetOf,
    total() {
      return offsetOf(blockCount());
    },
    blockAtOffset(y) {
      const count = blockCount();
      let acc = 0;
      for (let i = 0; i < count; i++) {
        acc += heightOf(i);
        if (y < acc) return i;
      }
      return count - 1;
    },
    measure(block, height) {
      if (block < 0 || block >= blockCount() || !(height >= 0)) return;
      measured.set(block, height);
      const { first, last } = linesOf(block);
      const perLine = height / (last - first + 1);
      if (perLine > 0 && measured.size <= 4) estimate = perLine;
    },
    resize(newLineCount, fromBlock = 0) {
      lines = Math.max(1, newLineCount);
      const kept = new Map();
      for (const [b, h] of measured) if (b < fromBlock && b < blockCount()) kept.set(b, h);
      measured = kept;
    },
    windowFor(scrollTop, viewportHeight, margin = 1) {
      const count = blockCount();
      const first = Math.max(0, table.blockAtOffset(Math.max(0, scrollTop)) - margin);
      const last = Math.min(count - 1, table.blockAtOffset(Math.max(0, scrollTop) + Math.max(0, viewportHeight)) + margin);
      return { first, last };
    },
  };
  return table;
};

/**
 * @param {BlockTable} table
 * @param {number} line 1-based
 * @returns {number}
 */
export const blockOfLine = (table, line) => Math.min(table.blockCount - 1, Math.max(0, Math.floor((line - 1) / table.blockSize)));
