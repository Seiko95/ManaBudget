<script lang="ts">
	import { page } from '$app/state';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import ChartView from '$lib/components/ChartView.svelte';
	import MapView from '$lib/components/MapView.svelte';
	import { baseOptions, barsHeight, horizontalBars, type ChartTheme } from '$lib/charts';
	import { formatCents, formatCentsCompact } from '$lib/format';
	import {
		nextPeriod,
		periodLabelText,
		periodRangeText,
		periodShortText,
		prevPeriod
	} from '$lib/periods';
	import type { ChartConfiguration } from 'chart.js';
	import { t } from '$lib/i18n/fr';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let drillId = $state<number | null>(null);
	const drill = $derived(data.budgets.find((b) => b.id === drillId) ?? null);

	function href(params: Record<string, string | number | null>) {
		const u = new URL(page.url);
		for (const [k, v] of Object.entries(params)) {
			if (v === null) u.searchParams.delete(k);
			else u.searchParams.set(k, String(v));
		}
		return u.pathname + u.search;
	}

	const rangeTitle = $derived(
		data.n === 1
			? periodLabelText(data.end)
			: `${periodShortText(data.trend[12 - data.n].label)} – ${periodShortText(data.end)}`
	);

	// Spending by budget, or by category inside the selected budget
	const barItems = $derived(
		drill
			? drill.categories.map((c) => ({ label: c.name, cents: c.total, color: drill.color }))
			: data.budgets.map((b) => ({ label: `${b.icon} ${b.name}`, cents: b.total, color: b.color }))
	);

	function budgetChart(th: ChartTheme) {
		const cfg = horizontalBars(th, barItems, t.stats.spent);
		if (!drill)
			cfg.options!.onClick = (_e, els) => {
				if (els[0]) drillId = data.budgets[els[0].index].id;
			};
		return cfg;
	}

	// Income vs expense trend: two column series and a net line, one € axis
	function trendChart(th: ChartTheme): ChartConfiguration {
		const base = baseOptions(th);
		const income = th.dark ? '#199e70' : '#1baf7a';
		const expense = th.dark ? '#d95926' : '#eb6834';
		return {
			type: 'bar',
			data: {
				labels: data.trend.map((p) => periodShortText(p.label)),
				datasets: [
					{
						type: 'bar',
						label: t.stats.income,
						data: data.trend.map((p) => p.income),
						backgroundColor: income,
						borderRadius: 4,
						borderSkipped: 'start',
						maxBarThickness: 16,
						order: 2
					},
					{
						type: 'bar',
						label: t.stats.expenses,
						data: data.trend.map((p) => p.expense),
						backgroundColor: expense,
						borderRadius: 4,
						borderSkipped: 'start',
						maxBarThickness: 16,
						order: 2
					},
					{
						type: 'line',
						label: t.stats.net,
						data: data.trend.map((p) => p.income - p.expense),
						borderColor: th.text,
						backgroundColor: th.text,
						borderWidth: 2,
						pointRadius: 4,
						pointBorderColor: th.surface,
						pointBorderWidth: 2,
						pointHoverRadius: 6,
						tension: 0.25,
						order: 1
					}
				]
			},
			options: {
				...base,
				interaction: { mode: 'index', intersect: false },
				plugins: { ...base.plugins, legend: { ...base.plugins.legend, position: 'bottom' } },
				scales: {
					x: {
						grid: { display: false },
						border: { display: false },
						ticks: { color: th.muted, maxRotation: 0, autoSkip: true }
					},
					y: {
						grid: { color: th.grid },
						border: { display: false },
						ticks: {
							color: th.muted,
							callback: (v) => formatCentsCompact(Number(v)),
							maxTicksLimit: 6
						}
					}
				}
			}
		};
	}

	const topPlaces = $derived(data.places.slice(0, 10));
	const placeItems = $derived(
		topPlaces.map((p) => ({ label: p.name, cents: p.total, color: '#2a78d6' }))
	);
	const maxPlace = $derived(Math.max(1, ...data.places.map((p) => p.total)));
	const placeMarkers = $derived(
		data.places.map((p) => ({
			lat: p.lat,
			lng: p.lng,
			label: p.name,
			detail: formatCents(p.total),
			amountCents: p.total,
			// Area proportional to the amount
			radius: 6 + 22 * Math.sqrt(p.total / maxPlace),
			color: '#2a78d6',
			href: `/depenses?du=${data.range.from}&au=${data.range.to}&lieu=${p.placeId}`
		}))
	);
</script>

<svelte:head><title>{t.stats.title} · {t.app.name}</title></svelte:head>

<PageHeader title={t.stats.title} />

<div class="flex flex-wrap items-center justify-between gap-3 px-4 pb-4 lg:px-8">
	<div class="flex items-center gap-1">
		<a
			href={href({ fin: prevPeriod(data.end) })}
			class="inline-flex size-9 items-center justify-center rounded-md hover:bg-accent"
			aria-label={t.period.prev}
			data-sveltekit-noscroll
		>
			<ChevronLeft class="size-5" />
		</a>
		<div class="min-w-36 text-center leading-tight">
			<p class="font-semibold" data-testid="stats-range">{rangeTitle}</p>
			<p class="text-xs text-muted-foreground">
				{periodRangeText({ start: data.range.from, end: data.range.to })}
			</p>
		</div>
		<a
			href={href({ fin: nextPeriod(data.end) })}
			class="inline-flex size-9 items-center justify-center rounded-md hover:bg-accent"
			aria-label={t.period.next}
			data-sveltekit-noscroll
		>
			<ChevronRight class="size-5" />
		</a>
		{#if !data.isCurrent}
			<a
				href={href({ fin: null })}
				class="ml-1 text-xs font-medium underline"
				data-sveltekit-noscroll>{t.period.current}</a
			>
		{/if}
	</div>
	<div class="flex gap-1 rounded-lg bg-muted p-1" role="group" aria-label={t.stats.range}>
		{#each [1, 3, 6, 12] as n (n)}
			<a
				href={href({ n: n === 1 ? null : n })}
				aria-current={data.n === n ? 'true' : undefined}
				class="rounded-md px-3 py-1 text-sm font-medium aria-[current=true]:bg-background aria-[current=true]:shadow-sm"
				data-sveltekit-noscroll
			>
				{n === 1 ? t.stats.rangeOne : t.stats.rangeN.replace('{n}', String(n))}
			</a>
		{/each}
	</div>
</div>

<div class="grid gap-6 px-4 pb-10 lg:grid-cols-2 lg:px-8">
	<section class="rounded-xl border bg-card p-4" data-testid="chart-budgets">
		<div class="mb-1 flex items-center justify-between gap-2">
			<h2 class="font-semibold">
				{drill ? t.stats.byCategory.replace('{budget}', drill.name) : t.stats.byBudget}
			</h2>
			{#if drill}
				<button
					type="button"
					class="inline-flex items-center gap-1 text-sm underline"
					onclick={() => (drillId = null)}
				>
					<ArrowLeft class="size-4" />{t.stats.allBudgets}
				</button>
			{/if}
		</div>
		<p class="mb-3 text-sm text-muted-foreground">
			{t.stats.total} : {formatCents(drill ? drill.total : data.totals.expense)}
		</p>
		{#if barItems.length}
			{#key drillId}
				<div style="height: {barsHeight(barItems.length)}">
					<ChartView
						build={budgetChart}
						label={drill ? t.stats.byCategory.replace('{budget}', drill.name) : t.stats.byBudget}
						class="h-full"
					/>
				</div>
			{/key}
			{#if !drill}
				<p class="mt-3 text-xs text-muted-foreground">{t.stats.drillHint}</p>
				<ul class="mt-2 flex flex-wrap gap-1.5">
					{#each data.budgets as b (b.id)}
						<li>
							<button
								type="button"
								class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm hover:bg-accent"
								onclick={() => (drillId = b.id)}
							>
								<span class="size-2.5 rounded-full" style="background-color: {b.color}"
								></span>{b.name}
							</button>
						</li>
					{/each}
				</ul>
			{/if}
			<details class="mt-3 text-sm">
				<summary class="cursor-pointer text-muted-foreground">{t.stats.showTable}</summary>
				<table class="mt-2 w-full">
					<tbody>
						{#each barItems as i (i.label)}
							<tr class="border-t"
								><td class="py-1">{i.label}</td><td class="py-1 text-right tabular-nums"
									>{formatCents(i.cents)}</td
								></tr
							>
						{/each}
					</tbody>
				</table>
			</details>
		{:else}
			<p class="py-6 text-sm text-muted-foreground">{t.stats.noData}</p>
		{/if}
	</section>

	<section class="rounded-xl border bg-card p-4" data-testid="chart-trend">
		<h2 class="mb-3 font-semibold">{t.stats.trend}</h2>
		<ChartView build={trendChart} label={t.stats.trend} class="h-72" />
		<details class="mt-3 text-sm">
			<summary class="cursor-pointer text-muted-foreground">{t.stats.showTable}</summary>
			<div class="overflow-x-auto">
				<table class="mt-2 w-full min-w-80">
					<thead class="text-muted-foreground">
						<tr
							><th class="py-1 text-left font-normal">{t.stats.period}</th><th
								class="py-1 text-right font-normal">{t.stats.income}</th
							><th class="py-1 text-right font-normal">{t.stats.expenses}</th><th
								class="py-1 text-right font-normal">{t.stats.net}</th
							></tr
						>
					</thead>
					<tbody>
						{#each data.trend as p (p.label)}
							<tr class="border-t">
								<td class="py-1">{periodLabelText(p.label)}</td>
								<td class="py-1 text-right tabular-nums">{formatCents(p.income)}</td>
								<td class="py-1 text-right tabular-nums">{formatCents(p.expense)}</td>
								<td class="py-1 text-right tabular-nums">{formatCents(p.income - p.expense)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</details>
	</section>

	<section class="rounded-xl border bg-card p-4 lg:col-span-2" data-testid="chart-places">
		<h2 class="mb-3 font-semibold">{t.stats.places}</h2>
		{#if data.places.length}
			<div class="grid gap-4 lg:grid-cols-2">
				<div>
					<div style="height: {barsHeight(placeItems.length)}">
						<ChartView
							build={(th) => horizontalBars(th, placeItems, t.stats.spent)}
							label={t.stats.places}
							class="h-full"
						/>
					</div>
					<details class="mt-3 text-sm">
						<summary class="cursor-pointer text-muted-foreground">{t.stats.showTable}</summary>
						<table class="mt-2 w-full">
							<tbody>
								{#each data.places as p (p.placeId)}
									<tr class="border-t">
										<td class="py-1"
											>{p.name}
											<span class="text-muted-foreground"
												>· {t.stats.visits.replace('{n}', String(p.count))}</span
											></td
										>
										<td class="py-1 text-right tabular-nums">{formatCents(p.total)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</details>
				</div>
				<MapView
					markers={placeMarkers}
					class="h-72 lg:h-full lg:min-h-72"
					label={t.stats.placesMap}
				/>
			</div>
		{:else}
			<p class="py-6 text-sm text-muted-foreground">{t.stats.noPlaces}</p>
		{/if}
	</section>
</div>
