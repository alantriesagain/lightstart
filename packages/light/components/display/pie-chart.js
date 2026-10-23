import { html, svg } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { lcText } from "../utils/text.js";
/** @import { Prop, PieChartDatum } from "../types.ts" */

export default defineComponent({
	tag: "lc-pie-chart",
	style: true,

	props: {
		data: /** @type {Prop<PieChartDatum[]>} */ (T.array({ defaultValue: [] })),
		size: 200,
		donut: false,
		donutWidth: 40,
		showLabels: false,
		showLegend: true,
		centerLabel: T.string(),
		centerSub: T.string(),
	},

	_colors: [
		"var(--color-primary)",
		"var(--color-secondary)",
		"var(--color-success)",
		"var(--color-warning)",
		"var(--color-danger)",
		"var(--color-info, #3b82f6)",
		"#8b5cf6",
		"#ec4899",
		"#14b8a6",
		"#f97316",
	],

	render() {
		if (!this.data || this.data.length === 0)
			return html`<div class="pie-chart-empty">${lcText("lc-chart", "noData")}</div>`;

		const total = this.data.reduce((sum, d) => sum + (d.value || 0), 0);
		if (total === 0)
			return html`<div class="pie-chart-empty">${lcText("lc-chart", "noData")}</div>`;

		const center = this.size / 2;
		const radius = center - 10;
		const innerRadius = this.donut ? radius - this.donutWidth : 0;

		let currentAngle = -90;
		const slices = this.data.map((item, i) => {
			const percentage = (item.value || 0) / total;
			const angle = percentage * 360;
			const startAngle = currentAngle;
			const endAngle = currentAngle + angle;
			currentAngle = endAngle;

			return {
				...item,
				percentage,
				startAngle,
				endAngle,
				color: item.color || this._colors[i % this._colors.length],
			};
		});

		return html`
			<div class="pie-chart">
				<div class="pie-figure">
				<svg
					class="pie-chart-svg"
					width="${this.size}"
					height="${this.size}"
					viewBox="0 0 ${this.size} ${this.size}"
				>
					${slices.map((slice) => {
						const path = this._createSlicePath(center, radius, innerRadius, slice.startAngle, slice.endAngle);
						return svg`
							<path
								class="pie-slice"
								d="${path}"
								fill="${slice.color}"
							>
								<title>${slice.label}: ${slice.value} (${Math.round(slice.percentage * 100)}%)</title>
							</path>
						`;
					})}

					${this.donut ? svg`
						<circle
							class="pie-center"
							cx="${center}"
							cy="${center}"
							r="${innerRadius - 2}"
							fill="var(--color-surface)"
						></circle>
					` : ""}
				</svg>
				${this.donut && (this.centerLabel || this.centerSub) ? html`
					<div class="pie-center-text" style="max-width:${Math.max(innerRadius * 1.6, 0)}px">
						${this.centerLabel ? html`<span class="pie-center-label">${this.centerLabel}</span>` : ""}
						${this.centerSub ? html`<span class="pie-center-sub">${this.centerSub}</span>` : ""}
					</div>
				` : ""}
				</div>

				${this.showLegend ? html`
					<div class="pie-legend">
						${slices.map((slice) => html`
							<div class="pie-legend-item">
								<span class="pie-legend-color" style="background: ${slice.color}"></span>
								<span class="pie-legend-label">${slice.label}</span>
								<span class="pie-legend-value">${Math.round(slice.percentage * 100)}%</span>
							</div>
						`)}
					</div>
				` : ""}
			</div>
		`;
	},

	/**
	 * @param {number} center
	 * @param {number} outerRadius
	 * @param {number} innerRadius
	 * @param {number} startAngle
	 * @param {number} endAngle
	 */
	_createSlicePath(center, outerRadius, innerRadius, startAngle, endAngle) {
		const startRad = (startAngle * Math.PI) / 180;
		const endRad = (endAngle * Math.PI) / 180;

		const x1 = center + outerRadius * Math.cos(startRad);
		const y1 = center + outerRadius * Math.sin(startRad);
		const x2 = center + outerRadius * Math.cos(endRad);
		const y2 = center + outerRadius * Math.sin(endRad);

		const largeArc = endAngle - startAngle > 180 ? 1 : 0;

		if (innerRadius > 0) {

			const x3 = center + innerRadius * Math.cos(endRad);
			const y3 = center + innerRadius * Math.sin(endRad);
			const x4 = center + innerRadius * Math.cos(startRad);
			const y4 = center + innerRadius * Math.sin(startRad);

			return `
				M ${x1} ${y1}
				A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2}
				L ${x3} ${y3}
				A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}
				Z
			`;
		}

		return `
			M ${center} ${center}
			L ${x1} ${y1}
			A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2}
			Z
		`;
	},
});
