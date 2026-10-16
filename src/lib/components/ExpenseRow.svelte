<script lang="ts">
	import Camera from '@lucide/svelte/icons/camera';
	import Repeat from '@lucide/svelte/icons/repeat';
	import { formatCents } from '$lib/format';
	import type { ListedExpense } from '$lib/server/expenses';
	import { t } from '$lib/i18n/fr';

	let { expense: e, showDate = false }: { expense: ListedExpense; showDate?: boolean } = $props();
	const first = $derived(e.splits[0]);
	const title = $derived(e.placeName || e.description || first?.categoryName || t.expenses.title);
	const subtitle = $derived(
		e.splits.length > 1
			? e.splits.map((s) => s.categoryName).join(' + ')
			: [first?.categoryName, e.placeName && e.description ? e.description : null]
					.filter(Boolean)
					.join(' · ')
	);
</script>

<a
	href="/depenses/{e.id}"
	class="flex items-center gap-3 px-4 py-3 hover:bg-accent/50"
	data-testid="expense-row"
>
	<span class="flex h-9 w-1.5 shrink-0 flex-col overflow-hidden rounded-full" aria-hidden="true">
		{#each e.splits as s (s.categoryId)}
			<span style="background-color: {s.budgetColor}; flex: {s.amountCents}"></span>
		{/each}
	</span>
	<div class="min-w-0 flex-1">
		<p class="truncate font-medium">{title}</p>
		<p class="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
			{#if showDate}<span>{e.date.slice(8, 10)}/{e.date.slice(5, 7)}</span> ·{/if}
			<span class="truncate">{subtitle}</span>
			{#if e.photoCount}<Camera class="size-3.5 shrink-0" aria-label={t.expenses.photos} />{/if}
			{#if e.recurringRuleId}<Repeat class="size-3.5 shrink-0" aria-label={t.nav.recurring} />{/if}
		</p>
		{#if e.tags.length}
			<p class="mt-1 flex flex-wrap gap-1">
				{#each e.tags as tag (tag.id)}
					<span
						class="rounded-full px-1.5 text-xs"
						style="background-color: color-mix(in oklab, {tag.color} 20%, transparent)"
						>{tag.name}</span
					>
				{/each}
			</p>
		{/if}
	</div>
	<span class="shrink-0 font-semibold tabular-nums">{formatCents(e.totalCents)}</span>
</a>
