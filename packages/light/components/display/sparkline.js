import { html, svg } from "@bootstrapp/light/html";
import T from "@bootstrapp/light/types";
import { defineComponent } from "@bootstrapp/light";
import { uniqueId } from "../utils/id.js";

/** @import { Prop, SparklineDatum } from "../types.ts" */

export default defineComponent({
	tag: "lc-sparkline",
	style: true,

	props: {
		data: /** @type {Prop<SparklineDatum[]>} */ (T.array({ defaultValue: [] })),
		width: 80,
		height: 24,
		variant: T.string({
			defaultValue: "primary",
			enum: ["primary", "secondary", "success", "warning", "error"],
		}),
		showArea: false,
		smooth: true,
		_gradientId: T.string({ reactive: false, defaultValue: "" }),
	},

	render() {
		const values = this._normalizeData();
		if (values.length === 0)
			return html`<span class="sparkline-empty">–</span>`;

		const maxValue = Math.max(...values, 1);
		const minValue = Math.min(...values, 0);
		const range = maxValue - minValue || 1;

		const padding = 2;
		const chartWidth = this.width - padding * 2;
		const chartHeight = this.height - padding * 2;
		const stepX = values.length > 1 ? chartWidth / (values.length - 1) : 0;

		const points = values.map((value, i) => {
			const x = padding + i * stepX;
			const normalizedValue = (value - minValue) / range;
			const y = padding + chartHeight - normalizedValue * chartHeight;
			return { x, y, value };
		});

		const linePath = this._createPath(points);
		const areaPath = this._createAreaPath(points, this.height - padding);

		return html`
			<svg
				class="sparkline sparkline-${this.variant}"
				width="${this.width}"
				height="${this.height}"
				viewBox="0 0 ${this.width} ${this.height}"
			>
				${this.showArea ? this._area(areaPath) : ""}
				<path
					class="sparkline-line"
					d="${linePath}"
					fill="none"
					stroke-linecap="round"
					stroke-linejoin="round"
				></path>
			</svg>
		`;
	},

	_normalizeData() {
		if (!this.data || this.data.length === 0) return [];
		return this.data.map((d) => (typeof d === "number" ? d : d.value || 0));
	},

	/** @param {string} areaPath */
	_area(areaPath) {
		this._gradientId ||= uniqueId("sparkline-area-");
		return svg`
			<defs>
				<linearGradient id=${this._gradientId} x1="0" y1="0" x2="0" y2="1">
					<stop class="sparkline-area-top" offset="0"></stop>
					<stop class="sparkline-area-bottom" offset="1"></stop>
				</linearGradient>
			</defs>
			<path class="sparkline-area" d="${areaPath}" fill="url(#${this._gradientId})"></path>
		`;
	},

	/** @param {{ x: number, y: number, value: number }[]} points */
	_createPath(points) {
		if (points.length === 0) return "";
		if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

		if (this.smooth && points.length > 2)
			return this._createSmoothPath(points);

		return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
	},

	/** @param {{ x: number, y: number, value: number }[]} points */
	_createSmoothPath(points) {
		let path = `M ${points[0].x} ${points[0].y}`;

		for (let i = 0; i < points.length - 1; i++) {
			const p0 = points[i];
			const p1 = points[i + 1];
			const midX = (p0.x + p1.x) / 2;
			path += ` Q ${p0.x} ${p0.y}, ${midX} ${(p0.y + p1.y) / 2}`;
		}

		const last = points[points.length - 1];
		path += ` T ${last.x} ${last.y}`;

		return path;
	},

	/**
	 * @param {{ x: number, y: number, value: number }[]} points
	 * @param {number} baseY
	 */
	_createAreaPath(points, baseY) {
		if (points.length === 0) return "";

		const linePath = this._createPath(points);
		const first = points[0];
		const last = points[points.length - 1];

		return `${linePath} L ${last.x} ${baseY} L ${first.x} ${baseY} Z`;
	},
});
