import type { ChartConfiguration, TooltipItem } from 'chart.js';
import { formatCents, formatCentsCompact } from './format';
import { budgetColor } from './colors';

export type ChartTheme = {
	dark: boolean;
	text: string;
	muted: string;
	grid: string;
	surface: string;
};

/** Shared Chart.js options: € everywhere, recessive grid, readable at phone width. */
export function baseOptions(th: ChartTheme) {
	return {
		responsive: true,
		maintainAspectRatio: false,
		animation: { duration: 300 },
		font: { family: "'Inter Variable', sans-serif" },
		plugins: {
			legend: {
				labels: {
					color: th.text,
					boxWidth: 12,
					boxHeight: 12,
					usePointStyle: true,
					font: { size: 12 }
				}
			},
			tooltip: {
				callbacks: {
					label: (ctx: TooltipItem<'bar' | 'line'>) =>
						`${ctx.dataset.label ? ctx.dataset.label + ' : ' : ''}${formatCents(Number(ctx.raw))}`
				}
			}
		}
	};
}

export type BarItem = { label: string; cents: number; color: string };

/** Horizontal bars (one series), each bar in its own colour. */
export function horizontalBars(
	th: ChartTheme,
	items: BarItem[],
	seriesLabel: string
): ChartConfiguration<'bar'> {
	const base = baseOptions(th);
	return {
		type: 'bar',
		data: {
			labels: items.map((i) => i.label),
			datasets: [
				{
					label: seriesLabel,
					data: items.map((i) => i.cents),
					backgroundColor: items.map((i) => budgetColor(i.color, th.dark)),
					borderRadius: 4,
					borderSkipped: 'start',
					maxBarThickness: 24,
					categoryPercentage: 0.8,
					barPercentage: 0.9
				}
			]
		},
		options: {
			...base,
			indexAxis: 'y',
			plugins: {
				...base.plugins,
				legend: { display: false },
				tooltip: { callbacks: { label: (ctx) => formatCents(Number(ctx.raw)) } }
			},
			scales: {
				x: {
					beginAtZero: true,
					grid: { color: th.grid },
					border: { display: false },
					ticks: {
						color: th.muted,
						callback: (v) => formatCentsCompact(Number(v)),
						maxTicksLimit: 5
					}
				},
				y: {
					grid: { display: false },
					border: { display: false },
					ticks: { color: th.text, font: { size: 12 }, autoSkip: false }
				}
			}
		}
	};
}

/** Height for a horizontal bar chart so every label stays readable. */
export const barsHeight = (n: number) => `${Math.max(120, n * 34 + 40)}px`;
