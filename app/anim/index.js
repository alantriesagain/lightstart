/**
 * @bootstrapp/anim: easing curves, damped springs and dt-driven tweens.
 *
 * Two ways to move a value, deliberately kept apart:
 *   spring.js  BAKES motion into a `{t, value}` keyframe channel ahead of time
 *   tween.js   INTEGRATES it live, stepped by whoever owns the clock
 *
 * Nothing here touches rAF, the DOM, or `$APP`: it is pure and node-safe, so
 * both the video renderer and the game loop can rely on identical curves.
 */

export { linear, easeIn, easeOut, easeInOut, easeInBack, easeOutBack, easeInOutBack, easeOutBounce, easeInBounce, easeOutElastic, EASINGS, EASING_NAMES, ease } from "./easing.js";
export { sampleSpring, simplifyChannel, springChannel, springDurationMs } from "./spring.js";
export { cubicBezier, interpChannel } from "./channel.js";
export { createTween, createTimeline, createSpring } from "./tween.js";
