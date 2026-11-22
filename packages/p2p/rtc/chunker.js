/**
 * @file Data-channel chunker: a message becomes `id:index:total\n` framed
 * slices no larger than `maxSize`, and the receiver reassembles them in
 * any order. Pure: no app, no DOM.
 */

const HEADER = /^(\d+):(\d+):(\d+)\n/;

/**
 * @param {{ maxSize?: number, maxPending?: number }} [options]
 * @returns {{ split: (text: string) => string[], push: (frame: string) => string | null, pendingCount: () => number }}
 */
export const createChunker = ({ maxSize = 16384, maxPending = 256 } = {}) => {
  let nextId = 1;
  /** @type {Map<string, { parts: Array<string | undefined>, received: number }>} */
  const pending = new Map();

  /** @param {string} text @returns {string[]} */
  const split = (text) => {
    const id = String(nextId++);
    const room = maxSize - `${id}:${text.length}:${text.length}\n`.length;
    if (room < 1) throw new Error(`chunker: maxSize ${maxSize} leaves no room for a payload`);
    const total = Math.max(1, Math.ceil(text.length / room));
    const frames = [];
    for (let index = 0; index < total; index++)
      frames.push(`${id}:${index}:${total}\n${text.slice(index * room, (index + 1) * room)}`);
    return frames;
  };

  /**
   * @param {string} frame
   * @returns {string | null} the whole message once its last slice lands
   */
  const push = (frame) => {
    const match = HEADER.exec(frame);
    if (!match) return null;
    const [header, id, indexText, totalText] = match;
    const index = Number(indexText);
    const total = Number(totalText);
    if (!(total > 0) || !(index >= 0) || index >= total) return null;
    const body = frame.slice(header.length);
    if (total === 1) return body;
    let entry = pending.get(id);
    if (!entry) {
      if (pending.size >= maxPending) pending.delete(/** @type {string} */ (pending.keys().next().value));
      entry = { parts: new Array(total), received: 0 };
      pending.set(id, entry);
    }
    if (entry.parts[index] !== undefined) return null;
    entry.parts[index] = body;
    entry.received++;
    if (entry.received < total) return null;
    pending.delete(id);
    return entry.parts.join("");
  };

  return { split, push, pendingCount: () => pending.size };
};
