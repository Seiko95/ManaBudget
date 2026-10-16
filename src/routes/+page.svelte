<script lang="ts">
	import { page } from '$app/state';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import PeriodSwitcher from '$lib/components/PeriodSwitcher.svelte';
	import BudgetProgress from '$lib/components/BudgetProgress.svelte';
	import ExpenseRow from '$lib/components/ExpenseRow.svelte';
	import { alertMessageClient } from '$lib/alert-text';
	import { formatCents } from '$lib/format';
	import { t } from '$lib/i18n/fr';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const balance = $derived(data.totals.income - data.totals.expense);
	const alerts = $derived(
		data.budgets.filter((b) => b.status === 'warning' || b.status === 'over')
	);
	const limited = $derived(data.budgets.filter((b) => b.limitCents > 0));
	const unlimited = $derived(data.budgets.filter((b) => b.limitCents === 0 && b.spentCents > 0));
	const periodQuery = $derived(page.url.searchParams.get('periode'));
	const expensesHref = (extra = '') =>
		`/depenses?${periodQuery ? `periode=${periodQuery}&` : ''}${extra}`.replace(/[?&]$/, '');
</script>

<svelte:head><title>{t.dashboard.title} · {t.app.name}</title></svelte:head>

<div class="flex flex-wrap items-end justify-between gap-3 px-4 pt-6 pb-4 lg:px-8 lg:pt-8">
	<div>
		<p class="text-sm text-muted-foreground">
			{t.dashboard.greeting.replace('{name}', page.data.user?.displayName ?? '')}
		</p>
		<h1 class="text-2xl font-bold tracking-tight">{t.dashboard.title}</h1>
	</div>
	<PeriodSwitcher period={data.period} isCurrent={data.period.isCurrent} />
</div>

<div class="space-y-6 px-4 pb-10 lg:px-8">
	<div class="grid grid-cols-3 gap-2 sm:gap-4">
		<div class="rounded-xl border bg-card p-3 sm:p-4">
			<p class="text-xs text-muted-foreground sm:text-sm">{t.dashboard.income}</p>
			<p class="mt-1 text-base font-semibold tabular-nums sm:text-2xl" data-testid="tile-income">
				{formatCents(data.totals.income)}
			</p>
		</div>
		<div class="rounded-xl border bg-card p-3 sm:p-4">
			<p class="text-xs text-muted-foreground sm:text-sm">{t.dashboard.expenses}</p>
			<p class="mt-1 text-base font-semibold tabular-nums sm:text-2xl" data-testid="tile-expenses">
				{formatCents(data.totals.expense)}
			</p>
		</div>
		<div class="rounded-xl border bg-card p-3 sm:p-4">
			<p class="text-xs text-muted-foreground sm:text-sm">{t.dashboard.balance}</p>
			<p
				class="mt-1 text-base font-semibold tabular-nums sm:text-2xl {balance < 0
					? 'text-destructive'
					: 'text-emerald-700 dark:text-emerald-400'}"
				data-testid="tile-balance"
			>
				{formatCents(balance)}
			</p>
		</div>
	</div>

	{#if alerts.length}
		<div
			role="status"
			class="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4"
			data-testid="alert-banner"
		>
			<p class="flex items-center gap-2 font-semibold">
				<TriangleAlert class="size-4" />{t.alerts.banner}
			</p>
			<ul class="mt-1 space-y-0.5 text-sm">
				{#each alerts as a (a.id)}
					<li>{alertMessageClient(a)}</li>
				{/each}
			</ul>
		</div>
	{/if}

	<div class="grid gap-6 lg:grid-cols-2">
		<section class="rounded-xl border bg-card">
			<header class="flex items-center justify-between border-b px-4 py-3">
				<h2 class="font-semibold">{t.dashboard.budgets}</h2>
				<a href="/budgets" class="text-sm text-muted-foreground underline"
					>{t.dashboard.manageBudgets}</a
				>
			</header>
			<div class="p-1">
				{#each limited as b (b.id)}
					<BudgetProgress budget={b} href={expensesHref(`budget=${b.id}`)} />
				{/each}
				{#each unlimited as b (b.id)}
					<BudgetProgress budget={b} href={expensesHref(`budget=${b.id}`)} />
				{/each}
				{#if !limited.length && !unlimited.length}
					<p class="px-3 py-4 text-sm text-muted-foreground">{t.dashboard.noExpenses}</p>
				{/if}
			</div>
		</section>

		<section class="rounded-xl border bg-card">
			<header class="flex items-center justify-between border-b px-4 py-3">
				<h2 class="font-semibold">{t.dashboard.latest}</h2>
				<a href={expensesHref()} class="text-sm text-muted-foreground underline"
					>{t.dashboard.seeAll}</a
				>
			</header>
			{#if data.latest.length}
				<div class="divide-y">
					{#each data.latest as e (e.id)}
						<ExpenseRow expense={e} showDate />
					{/each}
				</div>
			{:else}
				<p class="px-4 py-6 text-sm text-muted-foreground">{t.dashboard.noExpenses}</p>
			{/if}
		</section>
	</div>
</div>
