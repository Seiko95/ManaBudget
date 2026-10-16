<script lang="ts">
	import { onMount } from 'svelte';
	import type { Chart as ChartType, ChartConfiguration } from 'chart.js';
	import type { ChartTheme } from '$lib/charts';

	/**
	 * Chart.js wrapper. `build` receives the current theme so colours can be
	 * re-derived when the system switches between light and dark mode.
	 */
	let {
		build,
		label,
		class: className = 'h-64'
	}: {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		build: (theme: ChartTheme) => ChartConfiguration<any, any, any>;
		label: string;
		class?: string;
	} = $props();

	let canvas: HTMLCanvasElement;
	let chart: ChartType | undefined;
	let ChartCtor: typeof ChartType | undefined = $state();
	let dark = $state(false);

	function theme(): ChartTheme {
		return dark
			? {
					dark,
					text: '#f0efec',
					muted: '#a3a29b',
					grid: 'rgba(255,255,255,0.08)',
					surface: '#1c1c1c'
				}
			: { dark, text: '#0b0b0b', muted: '#62615c', grid: 'rgba(0,0,0,0.07)', surface: '#ffffff' };
	}

	onMount(() => {
		const mq = window.matchMedia('(prefers-color-scheme: dark)');
		dark = mq.matches;
		const onChange = (e: MediaQueryListEvent) => (dark = e.matches);
		mq.addEventListener('change', onChange);
		import('chart.js/auto').then((mod) => {
			ChartCtor = mod.default;
		});
		return () => {
			mq.removeEventListener('change', onChange);
			chart?.destroy();
		};
	});

	$effect(() => {
		if (!ChartCtor) return;
		const config = build(theme());
		chart?.destroy();
		chart = new ChartCtor(canvas, config);
	});
</script>

<div class="relative {className}" role="img" aria-label={label}>
	<canvas bind:this={canvas}></canvas>
</div>
