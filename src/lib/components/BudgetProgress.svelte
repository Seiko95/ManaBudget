<script lang="ts">
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import { STATUS_COLORS } from '$lib/colors';
	import { formatCents, formatPercent } from '$lib/format';
	import type { BudgetStatus } from '$lib/server/alerts';
	import { t } from '$lib/i18n/fr';

	let { budget: b, href }: { budget: BudgetStatus; href?: string } = $props();

	const color = $derived(
		b.status === 'over'
			? STATUS_COLORS.over
			: b.status === 'warning'
				? STATUS_COLORS.warning
				: STATUS_COLORS.ok
	);
	const statusLabel = $derived(
		b.status === 'over'
			? t.alerts.statusOver
			: b.status === 'warning'
				? t.alerts.statusWarning
				: t.alerts.statusOk
	);
	const plannedColor = $derived(
		b.projectedStatus === 'over'
			? STATUS_COLORS.over
			: b.projectedStatus === 'warning'
				? STATUS_COLORS.warning
				: STATUS_COLORS.ok
	);
	const remaining = $derived(b.limitCents - b.spentCents - b.plannedCents);
	const plannedWidth = $derived(Math.max(0, Math.min(100, b.projectedPct) - Math.min(100, b.pct)));
	// Shown when the planned part alone would push the budget to a worse status
	const projectedLabel = $derived(
		b.plannedCents > 0 && b.projectedStatus !== b.status
			? b.projectedStatus === 'over'
				? t.dashboard.projectedOver
				: b.projectedStatus === 'warning'
					? t.dashboard.projectedWarning
					: null
			: null
	);
</script>

<a
	{href}
	class="block rounded-lg px-3 py-2.5 hover:bg-accent/50"
	data-testid="budget-progress"
	data-status={b.status}
>
	<div class="flex items-center gap-2">
		<span
			class="size-2.5 shrink-0 rounded-full"
			style="background-color: {b.color}"
			aria-hidden="true"
		></span>
		<span class="min-w-0 flex-1 truncate font-medium">{b.icon} {b.name}</span>
		{#if b.status === 'warning' || b.status === 'over'}
			<span
				class="inline-flex items-center gap-1 text-xs font-semibold {b.status === 'over'
					? 'text-red-700 dark:text-red-400'
					: 'text-amber-700 dark:text-amber-400'}"
			>
				{#if b.status === 'over'}<CircleAlert class="size-3.5" />{:else}<TriangleAlert
						class="size-3.5"
					/>{/if}
				{statusLabel}
			</span>
		{:else if projectedLabel}
			<span
				class="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground"
				data-testid="projected-status"
			>
				<TriangleAlert class="size-3.5" />{projectedLabel}
			</span>
		{/if}
		<span class="text-sm tabular-nums">
			{#if b.limitCents > 0}{formatPercent(Math.floor(b.pct))}{#if b.plannedCents > 0}<span
						class="text-muted-foreground"
					>
						→ {formatPercent(Math.floor(b.projectedPct))}</span
					>{/if}{/if}
		</span>
	</div>
	{#if b.limitCents > 0}
		<div
			class="mt-1.5 flex h-2.5 overflow-hidden rounded-full bg-muted"
			role="progressbar"
			aria-label="{b.name} : {statusLabel}"
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={Math.min(100, Math.round(b.pct))}
		>
			<div
				class="h-full rounded-full transition-[width] duration-500"
				style="width: {Math.min(100, b.pct)}%; background-color: {color}"
			></div>
			{#if plannedWidth > 0}
				<div
					class="h-full rounded-r-full transition-[width] duration-500"
					style="width: {plannedWidth}%; background: repeating-linear-gradient(135deg, {plannedColor} 0 3px, color-mix(in oklab, {plannedColor} 30%, transparent) 3px 6px)"
					data-testid="planned-bar"
				></div>
			{/if}
		</div>
		<div class="mt-1 flex justify-between text-xs text-muted-foreground tabular-nums">
			<span>
				{t.dashboard.spentOf
					.replace('{spent}', formatCents(b.spentCents))
					.replace('{limit}', formatCents(b.limitCents))}
				{#if b.plannedCents > 0}
					· {t.dashboard.plannedPart.replace('{amount}', formatCents(b.plannedCents))}{/if}
			</span>
			<span class={remaining < 0 ? 'font-medium text-destructive' : ''}>
				{#if b.plannedCents > 0}
					{remaining >= 0
						? t.dashboard.leftAfterPlanned.replace('{amount}', formatCents(remaining))
						: t.dashboard.overPlanned.replace('{amount}', formatCents(-remaining))}
				{:else}
					{remaining >= 0
						? t.dashboard.left.replace('{amount}', formatCents(remaining))
						: t.dashboard.over.replace('{amount}', formatCents(-remaining))}
				{/if}
			</span>
		</div>
	{:else}
		<p class="mt-0.5 text-xs text-muted-foreground tabular-nums">
			{t.dashboard.spentNoLimit.replace('{spent}', formatCents(b.spentCents))}
			{#if b.plannedCents > 0}
				· {t.dashboard.plannedPart.replace('{amount}', formatCents(b.plannedCents))}{/if}
			· {t.alerts.statusNone}
		</p>
	{/if}
</a>
