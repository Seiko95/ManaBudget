<script lang="ts">
	import { page } from '$app/state';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import {
		nextPeriod,
		periodLabelText,
		periodRangeText,
		prevPeriod,
		type Period
	} from '$lib/periods';
	import { t } from '$lib/i18n/fr';

	let { period, isCurrent = false }: { period: Period; isCurrent?: boolean } = $props();

	function hrefFor(label: string | null) {
		const u = new URL(page.url);
		if (label) u.searchParams.set('periode', label);
		else u.searchParams.delete('periode');
		return u.pathname + u.search;
	}
</script>

<div class="flex items-center gap-1" data-testid="period-switcher">
	<a
		href={hrefFor(prevPeriod(period.label))}
		class="inline-flex size-9 items-center justify-center rounded-md hover:bg-accent"
		aria-label={t.period.prev}
		data-sveltekit-noscroll
	>
		<ChevronLeft class="size-5" />
	</a>
	<div class="min-w-36 text-center leading-tight">
		<p class="font-semibold">{periodLabelText(period.label)}</p>
		<p class="text-xs text-muted-foreground">{periodRangeText(period)}</p>
	</div>
	<a
		href={hrefFor(nextPeriod(period.label))}
		class="inline-flex size-9 items-center justify-center rounded-md hover:bg-accent"
		aria-label={t.period.next}
		data-sveltekit-noscroll
	>
		<ChevronRight class="size-5" />
	</a>
	{#if !isCurrent}
		<a href={hrefFor(null)} class="ml-1 text-xs font-medium underline" data-sveltekit-noscroll>
			{t.period.current}
		</a>
	{/if}
</div>
