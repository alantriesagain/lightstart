import { html, svg } from "/app/light/html/index.js";
import T from "/app/light/types/types.js";
import { defineComponent } from "/app/light/view/index.js";
import { uniqueId } from "../utils/id.js";
import { lcText } from "../utils/text.js";
/** @import { Prop, ChartDataPoint } from "../types.js" */

export default defineComponent({
	tag: "lc-line-chart",
	style: true,

	props: {
		data: /** @type {Prop<ChartDataPoint[]>} */ (T.array({ defaultValue: [] })),
		height: 200,
		variant: T.string({
			defaultValue: "primary",
			enum: ["primary", "secondary", "success", "warning", "error", "info"],
		}),
		showLabels: true,
		showDots: true,
		showArea: false,
		smooth: true,
		fit: false,
		reference: /** @type {Prop<number | null>} */ (T.number({ defaultValue: null })),
		_gradientId: T.string({ reactive: false, defaultValue: "" }),
	},

	render() {
		if (!this.data || this.data.length === 0)
			return html`<div class="line-chart-empty">${lcText("lc-chart", "noData")}</div>`;

		const reference = typeof this.reference === "number" ? this.reference : null;
		const values = this.data.map((d) => d.value || 0);
		const spanned = reference === null ? values : [...values, reference];
		const [minValue, maxValue] = this._scale(spanned);
		const range = maxValue - minValue || 1;

		const viewWidth = 300;
		const viewHeight = 100;
		const padding = { top: 8, right: 8, bottom: this.showLabels ? 20 : 8, left: 8 };
		const chartHeight = viewHeight - padding.top - padding.bottom;
		const chartWidth = viewWidth - padding.left - padding.right;
		const pointCount = this.data.length;
		const stepX = pointCount > 1 ? chartWidth / (pointCount - 1) : 0;

		const points = this.data.map((item, i) => {
			const x = padding.left + i * stepX;
			const normalizedValue = (item.value - minValue) / range;
			const y = padding.top + chartHeight - normalizedValue * chartHeight;
			return { x, y, ...item };
		});

		const linePath = this._createPath(points);
		const areaPath = this._createAreaPath(points, padding.top + chartHeight);
		const referenceY = reference === null ? null : padding.top + chartHeight - ((reference - minValue) / range) * chartHeight;

		return html`
			<div class="line-chart line-chart-${this.variant}" style="height: ${this.height}px">
				<svg
					class="line-chart-svg"
					viewBox="0 0 ${viewWidth} ${viewHeight}"
					preserveAspectRatio="none"
				>
					${this.showArea ? this._area(areaPath) : ""}
					${referenceY === null ? "" : svg`<line class="line-reference" x1="${padding.left}" x2="${viewWidth - padding.right}" y1="${referenceY}" y2="${referenceY}" stroke-dasharray="4 3"><title>${reference}</title></line>`}

					<path
						class="line-path"
						d="${linePath}"
						fill="none"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					></path>

					${this.showDots ? points.map((p) => svg`
						<circle
							class="line-dot"
							cx="${p.x}"
							cy="${p.y}"
							r="3"
						>
							<title>${p.label}: ${p.value}</title>
						</circle>
					`) : ""}

					${this.showLabels ? points.filter((_, i) => {

						if (pointCount <= 7) return true;
						if (pointCount <= 14) return i % 2 === 0;
						return i % Math.ceil(pointCount / 7) === 0;
					}).map((p) => svg`
						<text
							class="line-label"
							x="${p.x}"
							y="${viewHeight - 4}"
							text-anchor="middle"
						>${this._formatLabel(p.label)}</text>
					`) : ""}
				</svg>
			</div>
		`;
	},

	/**
	 * The value range the chart spans: from zero, or with `fit`, the values'
	 * own range with a margin above and below.
	 *
	 * @param {number[]} values
	 * @returns {[number, number]}
	 */
	_scale(values) {
		if (!this.fit) return [Math.min(...values, 0), Math.max(...values, 1)];
		const low = Math.min(...values);
		const high = Math.max(...values);
		const margin = (high - low || Math.abs(high) || 1) * 0.15;
		return [low - margin, high + margin];
	},

	/** @param {string} areaPath */
	_area(areaPath) {
		this._gradientId ||= uniqueId("line-chart-area-");
		return svg`
			<defs>
				<linearGradient id=${this._gradientId} x1="0" y1="0" x2="0" y2="1">
					<stop class="line-area-top" offset="0"></stop>
					<stop class="line-area-bottom" offset="1"></stop>
				</linearGradient>
			</defs>
			<path class="line-area" d="${areaPath}" fill="url(#${this._gradientId})"></path>
		`;
	},

	/** @param {{ x: number, y: number }[]} points */
	_createPath(points) {
		if (points.length === 0) return "";
		if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

		if (this.smooth && points.length > 2)
			return this._createSmoothPath(points);

		return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
	},

	/** @param {{ x: number, y: number }[]} points */
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
	 * @param {{ x: number, y: number }[]} points
	 * @param {number} baseY
	 */
	_createAreaPath(points, baseY) {
		if (points.length === 0) return "";

		const linePath = this._createPath(points);
		const first = points[0];
		const last = points[points.length - 1];

		return `${linePath} L ${last.x} ${baseY} L ${first.x} ${baseY} Z`;
	},

	/** @param {string | undefined} label */
	_formatLabel(label) {
		if (!label) return "";

		if (label.match(/^\d{4}-\d{2}-\d{2}/)) {
			const date = new Date(label);
			return `${date.getMonth() + 1}/${date.getDate()}`;
		}
		return label.length > 6 ? label.slice(0, 5) + "…" : label;
	},
});
