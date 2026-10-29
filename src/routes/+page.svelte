<script lang="ts">
	import { page } from '$app/state';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Repeat from '@lucide/svelte/icons/repeat';
	import CalendarClock from '@lucide/svelte/icons/calendar-clock';
	import HandCoins from '@lucide/svelte/icons/hand-coins';
	import PeriodSwitcher from '$lib/components/PeriodSwitcher.svelte';
	import BudgetProgress from '$lib/components/BudgetProgress.svelte';
	import ExpenseRow from '$lib/components/ExpenseRow.svelte';
	import { alertMessageClient } from '$lib/alert-text';
	import { formatCents, formatShortDate } from '$lib/format';
	import { t } from '$lib/i18n/fr';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const shownBalance = $derived(data.forecast ? data.balance.forecast : data.balance.current);
	const budgetColor = $derived(new Map(data.budgets.map((b) => [b.id, b.color])));
	const UPCOMING_SHOWN = 8;
	const upcomingHref = (i: (typeof data.planned.items)[number]) =>
		i.origin === 'rule' ? '/recurrents' : i.kind === 'income' ? '/revenus' : `/depenses/${i.refId}`;
	const alerts = $derived(
		data.budgets.filter((b) => b.status === 'warning' || b.status === 'over')
	);
	const limited = $derived(data.budgets.filter((b) => b.limitCents > 0));
	const unlimited = $derived(
		data.budgets.filter((b) => b.limitCents === 0 && (b.spentCents > 0 || b.plannedCents > 0))
	);
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
	<div
		class="grid grid-cols-2 gap-2 sm:gap-4 {data.forecast ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}"
	>
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
		{#if data.forecast}
			<div class="rounded-xl border border-dashed bg-card p-3 sm:p-4">
				<p class="text-xs text-muted-foreground sm:text-sm">{t.dashboard.planned}</p>
				<p class="mt-1 text-base font-semibold tabular-nums sm:text-2xl" data-testid="tile-planned">
					{formatCents(data.planned.expense)}
				</p>
				{#if data.planned.income > 0}
					<p class="text-xs text-muted-foreground tabular-nums">
						{t.dashboard.plannedIncome.replace('{amount}', formatCents(data.planned.income))}
					</p>
				{/if}
			</div>
		{/if}
		<a href="/epargne" class="rounded-xl border bg-card p-3 hover:bg-accent/50 sm:p-4">
			<p class="flex items-center gap-1.5 text-xs text-muted-foreground sm:text-sm">
				<HandCoins class="size-3.5" aria-hidden="true" />{t.dashboard.savings}
			</p>
			<p class="mt-1 text-base font-semibold tabular-nums sm:text-2xl" data-testid="tile-savings">
				{formatCents(data.savings.total)}
			</p>
			<p class="text-xs text-muted-foreground tabular-nums">
				{data.savings.period
					? t.dashboard.savingsPeriod.replace(
							'{amount}',
							`${data.savings.period > 0 ? '+' : ''}${formatCents(data.savings.period)}`
						)
					: t.dashboard.savingsCta}
			</p>
		</a>
		<div
			class="rounded-xl border bg-card p-3 sm:p-4 {data.forecast ? 'col-span-2 lg:col-span-1' : ''}"
		>
			<p class="text-xs text-muted-foreground sm:text-sm">
				{data.forecast ? t.dashboard.forecastBalance : t.dashboard.balance}
			</p>
			<p
				class="mt-1 text-base font-semibold tabular-nums sm:text-2xl {shownBalance < 0
					? 'text-destructive'
					: 'text-emerald-700 dark:text-emerald-400'}"
				data-testid="tile-balance"
			>
				{formatCents(shownBalance)}
			</p>
			{#if data.forecast}
				<p class="text-xs text-muted-foreground tabular-nums">
					{t.dashboard.currentBalance.replace('{amount}', formatCents(data.balance.current))}
				</p>
			{/if}
			{#if data.balance.carried}
				<p class="text-xs text-muted-foreground tabular-nums" data-testid="balance-carried">
					{t.dashboard.carried.replace('{amount}', formatCents(data.balance.carried))}
				</p>
			{/if}
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

	<div class="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
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

		<div class="min-w-0 space-y-6">
			{#if data.forecast}
				<section class="rounded-xl border bg-card" data-testid="upcoming">
					<header class="border-b px-4 py-3">
						<h2 class="font-semibold">{t.dashboard.upcoming}</h2>
						<p class="text-xs text-muted-foreground">{t.dashboard.upcomingHelp}</p>
					</header>
					{#if data.planned.items.length}
						<ul class="divide-y">
							{#each data.planned.items.slice(0, UPCOMING_SHOWN) as i, k (k)}
								<li>
									<a
										href={upcomingHref(i)}
										class="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/50"
										data-testid="upcoming-row"
									>
										<span
											class="size-2.5 shrink-0 rounded-full"
											style="background-color: {i.budgetId != null
												? budgetColor.get(i.budgetId)
												: 'var(--muted-foreground)'}"
											aria-hidden="true"
										></span>
										<span class="w-14 shrink-0 text-sm text-muted-foreground tabular-nums"
											>{formatShortDate(i.date)}</span
										>
										<span class="min-w-0 flex-1 truncate">{i.label}</span>
										{#if i.origin === 'rule'}
											<Repeat
												class="size-3.5 shrink-0 text-muted-foreground"
												aria-label={t.dashboard.recurring}
											/>
										{:else}
											<CalendarClock
												class="size-3.5 shrink-0 text-muted-foreground"
												aria-label={t.dashboard.plannedEntry}
											/>
										{/if}
										<span
											class="shrink-0 font-medium tabular-nums {i.kind === 'income'
												? 'text-emerald-700 dark:text-emerald-400'
												: ''}"
										>
											{i.kind === 'income' ? '+' : '−'}{formatCents(i.amountCents)}
										</span>
									</a>
								</li>
							{/each}
						</ul>
						{#if data.planned.items.length > UPCOMING_SHOWN}
							<p class="border-t px-4 py-2 text-sm text-muted-foreground">
								{t.dashboard.upcomingMore.replace(
									'{n}',
									String(data.planned.items.length - UPCOMING_SHOWN)
								)}
							</p>
						{/if}
					{:else}
						<p class="px-4 py-6 text-sm text-muted-foreground">{t.dashboard.upcomingEmpty}</p>
					{/if}
				</section>
			{/if}

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
</div>
