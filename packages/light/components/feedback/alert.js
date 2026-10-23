import T from "@bootstrapp/light/types";
/**
 * Alert Component
 *
 * @component
 * @category feedback
 * @tag lc-alert
 *
 * Inline alert/notification component for displaying status messages.
 * Similar to toast but static/inline rather than floating.
 *
 * @slot - Alert content
 *
 * @example Basic Alert
 * ```html
 * <lc-alert>This is a default alert message.</lc-alert>
 * ```
 *
 * @example Alert Variants
 * ```html
 * <lc-alert variant="success">Operation completed successfully!</lc-alert>
 * <lc-alert variant="error">An error occurred.</lc-alert>
 * <lc-alert variant="warning">Please review your input.</lc-alert>
 * <lc-alert variant="info">Here's some helpful information.</lc-alert>
 * ```
 *
 * @example Custom Icon
 * ```html
 * <lc-alert variant="success" icon="check">Custom icon alert</lc-alert>
 * ```
 *
 * @example In a List
 * ```javascript
 *
 *
 * export default {
 *   tag: "status-list",
 *   render() {
 *     const items = [
 *       { status: 'success', message: 'Build completed' },
 *       { status: 'error', message: 'Deploy failed' },
 *     ];
 *     return html`
 *       ${items.map(item => html`
 *         <lc-alert variant=${item.status}>${item.message}</lc-alert>
 *       `)}
 *     `;
 *   }
 * };
 * ```
 */
import { html } from "@bootstrapp/light/html";
import { defineComponent } from "@bootstrapp/light";

export default defineComponent({
	tag: "lc-alert",
	icons: ["circle-check", "circle-x", "triangle-alert", "info", "sticky-note", "lightbulb"],
	style: true,

	props: {
		variant: T.string({
			defaultValue: "default",
			enum: ["default", "success", "warning", "error", "info", "note", "tip"],
		}),
		icon: "",
		title: "",
	},

	/** @param {string} variant */
	_getIcon(variant) {
		const icons = {
			success: "circle-check",
			error: "circle-x",
			warning: "triangle-alert",
			info: "info",
			note: "sticky-note",
			tip: "lightbulb",
			default: "info",
		};
		return this.icon || icons[/** @type {keyof typeof icons} */ (variant)] || icons.default;
	},

	render() {
		return html`
			<div part="lc-alert-alert" class="alert alert-${this.variant}" role="alert">
				<div part="lc-alert-icon" class="alert-icon">
					<lc-icon name=${this._getIcon(this.variant)}></lc-icon>
				</div>
				<div part="lc-alert-content" class="alert-content">
					${this.title ? html`<div part="lc-alert-title" class="alert-title">${this.title}</div>` : ""}
					<slot></slot>
				</div>
			</div>
		`;
	},
});
