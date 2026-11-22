/**
 * @file A WebSocket that comes back: reconnects with doubling backoff until
 * closed on purpose. Pure: the constructor is injected for node tests.
 */

/**
 * @param {{
 *   url: string,
 *   protocols?: string[],
 *   binaryType?: BinaryType,
 *   WebSocket?: typeof WebSocket,
 *   initialDelay?: number,
 *   maxDelay?: number,
 *   maxAttempts?: number,
 *   onOpen?: () => void,
 *   onMessage?: (data: unknown) => void,
 *   onClose?: () => void,
 *   onGiveUp?: (attempts: number) => void,
 * }} options
 * @returns {{ url: string, isOpen: () => boolean, send: (data: string | Uint8Array | Blob) => boolean, close: () => void }}
 */
export const createReconnectingSocket = ({
  url, protocols, binaryType, WebSocket: Socket = globalThis.WebSocket,
  initialDelay = 3333, maxDelay = 60000, maxAttempts = Infinity, onOpen, onMessage, onClose, onGiveUp,
}) => {
  /** @type {WebSocket | null} */
  let sock = null;
  let delay = initialDelay;
  let failures = 0;
  let closed = false;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let timer = null;

  const connect = () => {
    if (closed) return;
    const next = protocols ? new Socket(url, protocols) : new Socket(url);
    if (binaryType) next.binaryType = binaryType;
    sock = next;
    next.addEventListener("open", () => {
      delay = initialDelay;
      failures = 0;
      onOpen?.();
    });
    next.addEventListener("message", (event) => onMessage?.(event.data));
    next.addEventListener("error", () => {});
    next.addEventListener("close", () => {
      if (sock !== next) return;
      sock = null;
      onClose?.();
      if (closed) return;
      failures++;
      if (failures >= maxAttempts) {
        closed = true;
        onGiveUp?.(failures);
        return;
      }
      timer = setTimeout(connect, delay);
      delay = Math.min(delay * 2, maxDelay);
    });
  };

  connect();

  return {
    url,
    isOpen: () => sock?.readyState === 1,
    /** @param {string | Uint8Array | Blob} data */
    send: (data) => {
      if (sock?.readyState !== 1) return false;
      sock.send(data instanceof Uint8Array ? /** @type {Uint8Array<ArrayBuffer>} */ (/** @type {unknown} */ (data)) : data);
      return true;
    },
    close: () => {
      closed = true;
      if (timer) clearTimeout(timer);
      timer = null;
      try { sock?.close(); } catch {}
      sock = null;
    },
  };
};
