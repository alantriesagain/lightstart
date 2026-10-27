import { html } from "/app/light/html/index.js";
import T from "/app/light/types/types.js";
import { defineComponent } from "/app/light/view/index.js";

export default defineComponent({
  tag: "lc-skeleton",
  props: {
    variant: T.string({
      defaultValue: "text",
      enum: ["text", "circle", "rect", "rounded"],
    }),
    width: "100%",
    height: "1em",
    count: 1,
    animated: true,
  },
  style: true,

  render() {
    const skeletons = Array.from({ length: this.count }, (/** @type {unknown} */ _, i) => i);

    return html`
      <div class="skeleton-container">
        ${skeletons.map(
          () => html`
            <div
              class="skeleton skeleton-${this.variant} ${this.animated ? "animated" : ""}"
              style="width: ${this.width}; height: ${this.height};"
            ></div>
          `,
        )}
      </div>
    `;
  },
});

/**
 * Skeleton Component
 *
 * @component
 * @category feedback
 * @tag lc-skeleton
 *
 * Loading placeholder that mimics the shape of content being loaded.
 *
 * @example
 * // Text skeleton
 * ```html
 * <lc-skeleton></lc-skeleton>
 * ```
 *
 * @example
 * // Multiple text lines
 * ```html
 * <lc-skeleton count="3"></lc-skeleton>
 * ```
 *
 * @example
 * // Circle skeleton (for avatars)
 * ```html
 * <lc-skeleton variant="circle" width="40px" height="40px"></lc-skeleton>
 * ```
 *
 * @example
 * // Rectangle skeleton (for images)
 * ```html
 * <lc-skeleton variant="rect" width="200px" height="150px"></lc-skeleton>
 * ```
 *
 * @example
 * // Rounded rectangle skeleton
 * ```html
 * <lc-skeleton variant="rounded" width="300px" height="200px"></lc-skeleton>
 * ```
 *
 * @example
 * // Without animation
 * ```html
 * <lc-skeleton animated="false"></lc-skeleton>
 * ```
 *
 * @example
 * // Loading card skeleton
 * ```html
 * <div style="border: 1px solid #ddd; padding: 1rem; border-radius: 8px;">
 *   <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
 *     <lc-skeleton variant="circle" width="48px" height="48px"></lc-skeleton>
 *     <div style="flex: 1;">
 *       <lc-skeleton width="40%" height="16px"></lc-skeleton>
 *       <lc-skeleton width="60%" height="12px"></lc-skeleton>
 *     </div>
 *   </div>
 *   <lc-skeleton variant="rounded" width="100%" height="200px"></lc-skeleton>
 *   <lc-skeleton count="3" height="12px"></lc-skeleton>
 * </div>
 * ```
 *
 * @example
 * // Loading list skeleton
 * ```html
 * <div style="display: flex; flex-direction: column; gap: 1rem;">
 *   ${[1, 2, 3, 4].map(() => html`
 *     <div style="display: flex; gap: 1rem; align-items: center;">
 *       <lc-skeleton variant="circle" width="32px" height="32px"></lc-skeleton>
 *       <div style="flex: 1;">
 *         <lc-skeleton width="80%" height="14px"></lc-skeleton>
 *         <lc-skeleton width="60%" height="12px"></lc-skeleton>
 *       </div>
 *     </div>
 *   `)}
 * </div>
 * ```
 *
 * @example
 * // Loading profile skeleton
 * ```html
 * <div style="text-align: center; padding: 2rem;">
 *   <div style="display: flex; justify-content: center; margin-bottom: 1rem;">
 *     <lc-skeleton variant="circle" width="120px" height="120px"></lc-skeleton>
 *   </div>
 *   <lc-skeleton width="200px" height="24px" style="margin: 0 auto 0.5rem;"></lc-skeleton>
 *   <lc-skeleton width="150px" height="16px" style="margin: 0 auto;"></lc-skeleton>
 *   <div style="margin-top: 2rem;">
 *     <lc-skeleton count="4" height="14px"></lc-skeleton>
 *   </div>
 * </div>
 * ```
 *
 * @example
 * // Loading table skeleton
 * ```html
 * <table style="width: 100%; border-collapse: collapse;">
 *   <thead>
 *     <tr>
 *       <th><lc-skeleton height="16px"></lc-skeleton></th>
 *       <th><lc-skeleton height="16px"></lc-skeleton></th>
 *       <th><lc-skeleton height="16px"></lc-skeleton></th>
 *     </tr>
 *   </thead>
 *   <tbody>
 *     ${[1, 2, 3, 4, 5].map(() => html`
 *       <tr>
 *         <td><lc-skeleton height="14px"></lc-skeleton></td>
 *         <td><lc-skeleton height="14px"></lc-skeleton></td>
 *         <td><lc-skeleton height="14px"></lc-skeleton></td>
 *       </tr>
 *     `)}
 *   </tbody>
 * </table>
 * ```
 *
 * @example
 * // Custom sizing
 * ```html
 * <div style="display: flex; flex-direction: column; gap: 0.5rem;">
 *   <lc-skeleton width="100%" height="20px"></lc-skeleton>
 *   <lc-skeleton width="90%" height="16px"></lc-skeleton>
 *   <lc-skeleton width="75%" height="16px"></lc-skeleton>
 *   <lc-skeleton width="85%" height="16px"></lc-skeleton>
 * </div>
 * ```
 */
