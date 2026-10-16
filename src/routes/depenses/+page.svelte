<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import Search from '@lucide/svelte/icons/search';
	import Plus from '@lucide/svelte/icons/plus';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import PeriodSwitcher from '$lib/components/PeriodSwitcher.svelte';
	import FormSheet from '$lib/components/FormSheet.svelte';
	import NativeSelect from '$lib/components/NativeSelect.svelte';
	import AmountInput from '$lib/components/AmountInput.svelte';
	import ExpenseRow from '$lib/components/ExpenseRow.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { formatCents, formatDay } from '$lib/format';
	import { isPeriodLabel, periodRange, periodLabelText } from '$lib/periods';
	import { openNewExpense } from '$lib/stores/ui.svelte';
	import { t } from '$lib/i18n/fr';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let filtersOpen = $state(false);
	let q = $derived(data.filters.q ?? '');

	const days = $derived.by(() => {
		const groups: { date: string; total: number; items: typeof data.expenses }[] = [];
		for (const e of data.expenses) {
			const last = groups.at(-1);
			if (last?.date === e.date) {
				last.items.push(e);
				last.total += e.totalCents;
			} else groups.push({ date: e.date, total: e.totalCents, items: [e] });
		}
		return groups;
	});

	const monthStartDay = $derived(page.data.user?.monthStartDay ?? 1);
	const periodObj = $derived(
		isPeriodLabel(data.filters.periode) ? periodRange(data.filters.periode, monthStartDay) : null
	);

	function withParams(update: Record<string, string | null>) {
		const u = new URL(page.url);
		for (const [k, v] of Object.entries(update)) {
			if (v === null || v === '') u.searchParams.delete(k);
			else u.searchParams.set(k, v);
		}
		u.searchParams.delete('limite');
		return u.pathname + u.search;
	}

	function submitSearch(e: SubmitEvent) {
		e.preventDefault();
		goto(withParams({ q: q.trim() || null }), { keepFocus: true, noScroll: true });
	}

	// Filter sheet state, seeded from the URL each time it opens
	let fPeriodMode = $state('period');
	let fDu = $state('');
	let fAu = $state('');
	let fBudget = $state('');
	let fCategory = $state('');
	let fPlace = $state('');
	let fTag = $state('');
	let fMin = $state('');
	let fMax = $state('');

	function openFilters() {
		const p = page.url.searchParams;
		fPeriodMode =
			data.filters.periode === 'tout'
				? 'all'
				: data.filters.periode === 'dates'
					? 'dates'
					: 'period';
		fDu = data.filters.from ?? '';
		fAu = data.filters.to ?? '';
		fBudget = p.get('budget') ?? '';
		fCategory = p.get('categorie') ?? '';
		fPlace = p.get('lieu') ?? '';
		fTag = p.get('etiquette') ?? '';
		fMin = p.get('min') ?? '';
		fMax = p.get('max') ?? '';
		filtersOpen = true;
	}

	function applyFilters(e: SubmitEvent) {
		e.preventDefault();
		const dates =
			fPeriodMode === 'dates'
				? { du: fDu || null, au: fAu || null, periode: null }
				: fPeriodMode === 'all'
					? { du: null, au: null, periode: 'tout' }
					: {
							du: null,
							au: null,
							periode: isPeriodLabel(data.filters.periode) ? data.filters.periode : null
						};
		filtersOpen = false;
		goto(
			withParams({
				...dates,
				budget: fBudget,
				categorie: fCategory,
				lieu: fPlace,
				etiquette: fTag,
				min: fMin,
				max: fMax
			}),
			{ noScroll: true }
		);
	}

	const resetHref = $derived.by(() => {
		const u = new URL(page.url);
		for (const k of [
			'budget',
			'categorie',
			'lieu',
			'etiquette',
			'min',
			'max',
			'q',
			'limite',
			'du',
			'au'
		])
			u.searchParams.delete(k);
		if (u.searchParams.get('periode') === 'tout') u.searchParams.delete('periode');
		return u.pathname + u.search;
	});

	const categoriesForBudget = $derived(
		fBudget
			? (data.options.budgets.find((b) => String(b.id) === fBudget)?.categories ?? [])
			: data.options.budgets.flatMap((b) => b.categories)
	);
</script>

<svelte:head><title>{t.expenses.title} · {t.app.name}</title></svelte:head>

<PageHeader title={t.expenses.title}>
	{#snippet actions()}
		<Button class="hidden lg:inline-flex" onclick={openNewExpense}
			><Plus />{t.expenses.newExpense}</Button
		>
	{/snippet}
</PageHeader>

<div class="space-y-3 px-4 pb-4 lg:px-8">
	<div class="flex flex-wrap items-center justify-between gap-3">
		{#if periodObj}
			<PeriodSwitcher
				period={{ ...periodObj, label: data.filters.periode }}
				isCurrent={!page.url.searchParams.get('periode')}
			/>
		{:else}
			<p class="font-semibold">
				{data.filters.periode === 'tout'
					? t.expenses.anyPeriod
					: `${data.filters.from ? formatDay(data.filters.from) : '…'} – ${data.filters.to ? formatDay(data.filters.to) : '…'}`}
			</p>
		{/if}
		<p class="text-sm text-muted-foreground" data-testid="expense-summary">
			{t.expenses.count
				.replace('{n}', String(data.summary.n))
				.replace('{total}', formatCents(data.summary.total))}
		</p>
	</div>
	<div class="flex gap-2">
		<form class="relative flex-1" onsubmit={submitSearch} role="search">
			<Search
				class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
			/>
			<Input
				type="search"
				bind:value={q}
				placeholder={t.expenses.searchPlaceholder}
				class="pl-8"
				aria-label={t.common.search}
				enterkeyhint="search"
			/>
		</form>
		<Button variant="outline" onclick={openFilters} aria-label={t.expenses.filters}>
			<SlidersHorizontal />
			<span class="hidden sm:inline">{t.expenses.filters}</span>
			{#if data.filters.active > 0}
				<span class="rounded-full bg-primary px-1.5 text-xs text-primary-foreground"
					>{data.filters.active}</span
				>
			{/if}
		</Button>
	</div>
	{#if data.filters.active > 0}
		<p class="text-sm">
			{t.expenses.activeFilters.replace('{n}', String(data.filters.active))} ·
			<a href={resetHref} class="font-medium underline">{t.expenses.resetFilters}</a>
		</p>
	{/if}
</div>

<div class="px-4 pb-8 lg:px-8">
	{#if days.length === 0}
		<p class="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
			{data.filters.active ? t.expenses.emptyFiltered : t.expenses.empty}
		</p>
	{:else}
		<div class="space-y-4">
			{#each days as day (day.date)}
				<section aria-label={formatDay(day.date)}>
					<header class="flex items-baseline justify-between px-1 pb-1.5 text-sm">
						<h2 class="font-medium first-letter:uppercase">{formatDay(day.date)}</h2>
						<span class="text-muted-foreground tabular-nums" title={t.expenses.dayTotal}
							>{formatCents(day.total)}</span
						>
					</header>
					<div class="divide-y overflow-hidden rounded-xl border bg-card">
						{#each day.items as e (e.id)}
							<ExpenseRow expense={e} />
						{/each}
					</div>
				</section>
			{/each}
		</div>
		{#if data.summary.n > data.expenses.length}
			<div class="mt-4 text-center">
				<Button
					variant="outline"
					href={withParams({ limite: String(data.limit + 200) })}
					data-sveltekit-noscroll
				>
					{t.expenses.loadMore}
				</Button>
			</div>
		{/if}
	{/if}
</div>

<FormSheet bind:open={filtersOpen} title={t.expenses.filters}>
	<form id="filters-form" class="space-y-5" onsubmit={applyFilters}>
		<div class="space-y-1.5">
			<Label for="f-period">{t.expenses.period}</Label>
			<NativeSelect id="f-period" bind:value={fPeriodMode}>
				<option value="period">
					{isPeriodLabel(data.filters.periode)
						? periodLabelText(data.filters.periode)
						: t.expenses.period}
				</option>
				<option value="all">{t.expenses.anyPeriod}</option>
				<option value="dates">{t.expenses.customRange}</option>
			</NativeSelect>
		</div>
		{#if fPeriodMode === 'dates'}
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1.5">
					<Label for="f-du">{t.expenses.from}</Label>
					<Input id="f-du" type="date" bind:value={fDu} />
				</div>
				<div class="space-y-1.5">
					<Label for="f-au">{t.expenses.to}</Label>
					<Input id="f-au" type="date" bind:value={fAu} />
				</div>
			</div>
		{/if}
		<div class="space-y-1.5">
			<Label for="f-budget">{t.expenses.budget}</Label>
			<NativeSelect id="f-budget" bind:value={fBudget} onchange={() => (fCategory = '')}>
				<option value="">{t.expenses.all}</option>
				{#each data.options.budgets as b (b.id)}
					<option value={String(b.id)}>{b.icon} {b.name}</option>
				{/each}
			</NativeSelect>
		</div>
		<div class="space-y-1.5">
			<Label for="f-category">{t.expenses.category}</Label>
			<NativeSelect id="f-category" bind:value={fCategory}>
				<option value="">{t.expenses.allFem}</option>
				{#each categoriesForBudget as c (c.id)}
					<option value={String(c.id)}>{c.name}</option>
				{/each}
			</NativeSelect>
		</div>
		<div class="space-y-1.5">
			<Label for="f-place">{t.expenses.place}</Label>
			<NativeSelect id="f-place" bind:value={fPlace}>
				<option value="">{t.expenses.all}</option>
				{#each data.options.places as p (p.id)}
					<option value={String(p.id)}>{p.name}</option>
				{/each}
			</NativeSelect>
		</div>
		<div class="space-y-1.5">
			<Label for="f-tag">{t.expenses.tags}</Label>
			<NativeSelect id="f-tag" bind:value={fTag}>
				<option value="">{t.expenses.allFem}</option>
				{#each data.options.tags as tag (tag.id)}
					<option value={String(tag.id)}>{tag.name}</option>
				{/each}
			</NativeSelect>
		</div>
		<div class="grid grid-cols-2 gap-3">
			<div class="space-y-1.5">
				<Label for="f-min">{t.expenses.minAmount}</Label>
				<AmountInput id="f-min" bind:value={fMin} />
			</div>
			<div class="space-y-1.5">
				<Label for="f-max">{t.expenses.maxAmount}</Label>
				<AmountInput id="f-max" bind:value={fMax} />
			</div>
		</div>
	</form>
	{#snippet footer()}
		<div class="flex gap-2">
			<Button
				variant="outline"
				class="flex-1"
				href={resetHref}
				onclick={() => (filtersOpen = false)}
			>
				{t.expenses.resetFilters}
			</Button>
			<Button type="submit" form="filters-form" class="flex-1">{t.expenses.apply}</Button>
		</div>
	{/snippet}
</FormSheet>
