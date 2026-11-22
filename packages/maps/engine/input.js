/**
 * The engine's input: pointers, wheel, double click and Safari's gesture
 * events on the map's container, read into intents the engine applies to
 * its camera. It keeps what reading them needs (the pointers down, how far
 * this drag has travelled, the last tap, the drag's recent samples) and
 * nothing about the camera.
 */
import { TAP_THRESHOLD_PX, isDoubleTap, pinchIntent, wheelZoomDelta } from "../lib/gestures.js";
import { pushSample, releaseVelocity } from "../lib/inertia.js";

/** @import { MapInputHandlers, VelocitySample } from "../types.ts" */

/**
 * @param {HTMLElement} container
 * @param {MapInputHandlers} on
 */
export const attachInput = (container, on) => {
  /** @type {Map<number, { x: number, y: number }>} */
  const pointers = new Map();
  /** @type {VelocitySample[]} */
  const samples = [];
  /** @type {{ t: number, x: number, y: number } | null} */
  let lastTap = null;
  let dragDist = 0;
  let lastDrag = 0;

  /** @param {{ clientX: number, clientY: number }} e */
  const localXY = (e) => {
    const r = container.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  const release = () => {
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    document.removeEventListener("pointercancel", onPointerUp);
  };

  /** @param {PointerEvent} e */
  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    on.grab();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      dragDist = 0;
      samples.length = 0;
    }
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
  };

  /** @param {PointerEvent} e */
  const onPointerMove = (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    if (pointers.size === 1) {
      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      dragDist += Math.hypot(dx, dy);
      pushSample(samples, { t: performance.now(), dx, dy });
      on.pan(dx, dy);
    } else if (pointers.size === 2) {
      const other = [...pointers.entries()].find(([id]) => id !== e.pointerId)?.[1];
      if (other) {
        const intent = pinchIntent(prev, cur, other);
        dragDist += intent.moved;
        const r = container.getBoundingClientRect();
        intent.x -= r.left;
        intent.y -= r.top;
        on.pinch(intent);
      }
    }
    pointers.set(e.pointerId, cur);
  };

  /** @param {PointerEvent} e */
  const onPointerUp = (e) => {
    if (!pointers.has(e.pointerId)) return;
    const wasSingle = pointers.size === 1;
    pointers.delete(e.pointerId);
    lastDrag = dragDist;
    if (!pointers.size) release();
    if (wasSingle && dragDist <= TAP_THRESHOLD_PX && e.pointerType === "touch") {
      const [px, py] = localXY(e);
      const tap = { t: performance.now(), x: px, y: py };
      if (isDoubleTap(lastTap, tap)) {
        lastTap = null;
        on.doubleTap(px, py);
      } else lastTap = tap;
    }
    if (wasSingle && dragDist > TAP_THRESHOLD_PX && samples.length > 1) {
      const velocity = releaseVelocity(samples, performance.now());
      if (velocity) on.fling(velocity);
    }
  };

  /** @param {WheelEvent} e */
  const onWheel = (e) => {
    e.preventDefault();
    const [px, py] = localXY(e);
    on.wheel(px, py, wheelZoomDelta(e.deltaY, e.ctrlKey));
  };

  /** @param {MouseEvent} e */
  const onDblClick = (e) => {
    e.preventDefault();
    const [px, py] = localXY(e);
    on.doubleTap(px, py);
  };

  /** @param {Event} e */
  const swallow = (e) => e.preventDefault();

  container.addEventListener("pointerdown", onPointerDown);
  container.addEventListener("wheel", onWheel, { passive: false });
  container.addEventListener("dblclick", onDblClick);
  container.addEventListener("gesturestart", swallow);
  container.addEventListener("gesturechange", swallow);

  return {
    /** @returns {boolean} whether the last gesture travelled past a tap */
    wasDragged: () => lastDrag > TAP_THRESHOLD_PX,
    /** @returns {boolean} whether a pointer is down */
    active: () => pointers.size > 0,
    destroy() {
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("wheel", onWheel);
      container.removeEventListener("dblclick", onDblClick);
      container.removeEventListener("gesturestart", swallow);
      container.removeEventListener("gesturechange", swallow);
      release();
      pointers.clear();
    },
  };
};
