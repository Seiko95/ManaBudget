<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import Plus from '@lucide/svelte/icons/plus';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Archive from '@lucide/svelte/icons/archive';
	import ArchiveRestore from '@lucide/svelte/icons/archive-restore';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { toast } from 'svelte-sonner';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import MapView from '$lib/components/MapView.svelte';
	import PlaceSheet from '$lib/components/PlaceSheet.svelte';
	import ConfirmAction from '$lib/components/ConfirmAction.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Switch } from '$lib/components/ui/switch';
	import { enhanceWithToast } from '$lib/forms';
	import { formatCents, formatDistance } from '$lib/format';
	import { periodLabelText } from '$lib/periods';
	import { sortByDistance } from '$lib/geo';
	import { geo, locateIfGranted } from '$lib/geolocation.svelte';
	import type { PlaceOption } from '$lib/types';
	import { t } from '$lib/i18n/fr';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let sheetOpen = $state(false);
	let editing = $state<Partial<PlaceOption> | null>(null);

	onMount(() => {
		locateIfGranted();
	});

	const sorted = $derived(
		geo.position
			? sortByDistance(data.places, geo.position)
			: data.places.map((p) => ({ ...p, distance: null as number | null }))
	);
	const markers = $derived(
		data.places
			.filter((p) => p.lat != null && p.lng != null && !p.archived)
			.map((p) => {
				const spent = data.spent[p.id] ?? 0;
				return {
					lat: p.lat!,
					lng: p.lng!,
					label: p.name,
					detail: spentText(spent),
					amountCents: spent
				};
			})
	);

	function spentText(cents: number) {
		const period = periodLabelText(data.period.label);
		return cents
			? t.places.spentIn.replace('{period}', period).replace('{amount}', formatCents(cents))
			: t.places.nothingSpentIn.replace('{period}', period);
	}

	function open(place: Partial<PlaceOption> | null) {
		editing = place;
		sheetOpen = true;
	}

	function toggleArchived(on: boolean) {
		const u = new URL(page.url);
		if (on) u.searchParams.set('archives', '1');
		else u.searchParams.delete('archives');
		goto(u.pathname + u.search, { noScroll: true, keepFocus: true });
	}
</script>

<svelte:head><title>{t.places.title} · {t.app.name}</title></svelte:head>

<PageHeader title={t.places.title} subtitle={t.places.subtitle}>
	{#snippet actions()}
		<Button onclick={() => open(null)}><Plus />{t.places.newPlace}</Button>
	{/snippet}
</PageHeader>

<div
	class="grid grid-cols-[minmax(0,1fr)] gap-4 px-4 pb-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:px-8"
>
	<div class="lg:sticky lg:top-4 lg:self-start">
		<MapView
			{markers}
			here={geo.position}
			class="h-64 lg:h-[calc(100dvh-10rem)]"
			label={t.places.map}
		/>
	</div>
	<div class="space-y-3">
		<label class="flex items-center gap-2 text-sm">
			<Switch checked={data.showArchived} onCheckedChange={toggleArchived} />
			{t.common.showArchived}
		</label>
		{#if sorted.length === 0}
			<p class="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
				{t.places.empty}
			</p>
		{:else}
			<ul class="divide-y rounded-xl border bg-card">
				{#each sorted as p (p.id)}
					<li
						class="flex items-center gap-3 px-4 py-3 {p.archived ? 'opacity-60' : ''}"
						data-testid="place-row"
					>
						<MapPin class="size-5 shrink-0 text-muted-foreground" />
						<div class="min-w-0 flex-1">
							<p class="font-medium">
								{p.name}
								{#if p.archived}<Badge variant="secondary">{t.common.archived}</Badge>{/if}
							</p>
							<p class="truncate text-sm text-muted-foreground">
								{#if p.distance != null}{formatDistance(p.distance)} ·
								{/if}{p.address || (p.lat == null ? t.places.noPosition : '')}
							</p>
							{#if p.defaultCategoryId}
								<p class="text-xs text-muted-foreground">
									{data.categoryNames[p.defaultCategoryId]}
								</p>
							{/if}
						</div>
						{#if data.spent[p.id]}
							<span
								class="shrink-0 text-sm font-medium tabular-nums"
								title={spentText(data.spent[p.id])}>{formatCents(data.spent[p.id])}</span
							>
						{/if}
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label={t.places.editPlace}
							onclick={() => open(p)}
						>
							<Pencil />
						</Button>
						<form method="POST" action="?/archive" use:enhance={enhanceWithToast()}>
							<input type="hidden" name="id" value={p.id} />
							<input type="hidden" name="archived" value={p.archived ? 'false' : 'true'} />
							<Button
								variant="ghost"
								size="icon-sm"
								type="submit"
								aria-label={p.archived ? t.common.unarchive : t.common.archive}
								title={p.archived ? t.common.unarchive : t.common.archive}
							>
								{#if p.archived}<ArchiveRestore />{:else}<Archive />{/if}
							</Button>
						</form>
						<ConfirmAction
							action="?/delete"
							fields={{ id: p.id }}
							title={t.places.deleteTitle.replace('{name}', p.name)}
							message={t.places.deleteConfirm}
							variant="ghost"
							size="icon-sm"
							submit={enhanceWithToast()}
						>
							<Trash2 /><span class="sr-only">{t.places.deletePlace}</span>
						</ConfirmAction>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>

<PlaceSheet
	bind:open={sheetOpen}
	initial={editing}
	budgets={data.budgets}
	onSaved={() => {
		toast.success(t.places.saved);
		invalidateAll();
	}}
/>
