<script lang="ts">
	import { Combobox } from 'bits-ui';
	import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import PlaceSheet from './PlaceSheet.svelte';
	import { sortByDistance } from '$lib/geo';
	import { geo } from '$lib/geolocation.svelte';
	import { formatDistance } from '$lib/format';
	import { normalize } from '$lib/text';
	import type { BudgetOption, PlaceOption } from '$lib/types';
	import { t } from '$lib/i18n/fr';

	let {
		places = $bindable([]),
		value = $bindable(null),
		budgets,
		id,
		onSelect
	}: {
		places?: PlaceOption[];
		value?: number | null;
		budgets: BudgetOption[];
		id?: string;
		onSelect?: (place: PlaceOption | null) => void;
	} = $props();

	const CREATE = '__create__';
	/** A suggestion chip is shown for the nearest place within this distance. */
	const NEAR_METRES = 500;

	let query = $state('');
	let open = $state(false);
	let sheetOpen = $state(false);
	let draftName = $state('');

	const selected = $derived(places.find((p) => p.id === value) ?? null);
	const withDistance = $derived(
		geo.position
			? sortByDistance(places, geo.position)
			: places.map((p) => ({ ...p, distance: null as number | null }))
	);
	const filtered = $derived.by(() => {
		const q = normalize(query);
		if (!q || (selected && q === normalize(selected.name))) return withDistance;
		return withDistance.filter((p) => normalize(`${p.name} ${p.address}`).includes(q));
	});
	const nearest = $derived(
		withDistance[0]?.distance != null && withDistance[0].distance <= NEAR_METRES
			? withDistance[0]
			: null
	);
	const items = $derived([
		...places.map((p) => ({ value: String(p.id), label: p.name })),
		{ value: CREATE, label: query }
	]);

	function choose(place: PlaceOption | null) {
		open = false;
		value = place?.id ?? null;
		query = place?.name ?? '';
		onSelect?.(place);
	}

	function onValueChange(v: string) {
		if (v === CREATE) {
			draftName = selected && normalize(query) === normalize(selected.name) ? '' : query.trim();
			open = false;
			sheetOpen = true;
			return;
		}
		choose(places.find((p) => String(p.id) === v) ?? null);
	}

	$effect(() => {
		// Keep the input text in sync when the value changes from outside (edit form).
		if (!open) query = selected?.name ?? '';
	});
</script>

{#if nearest && nearest.id !== value}
	<button
		type="button"
		class="mb-2 inline-flex max-w-full items-center gap-1.5 rounded-full border bg-secondary px-3 py-1 text-sm"
		onclick={() => choose(nearest)}
		data-testid="nearest-chip"
		aria-label="{t.expenses.nearest} : {nearest.name}"
	>
		<span aria-hidden="true">📍</span>
		<span class="truncate">{nearest.name}</span>
		<span class="text-muted-foreground">· {formatDistance(nearest.distance!)}</span>
	</button>
{/if}

<Combobox.Root
	type="single"
	value={value != null ? String(value) : ''}
	{onValueChange}
	bind:open
	{items}
	inputValue={query}
>
	<div class="relative">
		<MapPin
			class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
		/>
		<Combobox.Input
			{id}
			oninput={(e) => {
				query = e.currentTarget.value;
				open = true;
			}}
			onclick={() => (open = true)}
			placeholder={t.expenses.placePlaceholder}
			class="h-9 w-full rounded-md border border-input bg-transparent py-1 pr-16 pl-8 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
			autocomplete="off"
		/>
		<div class="absolute top-1/2 right-1 flex -translate-y-1/2 items-center">
			{#if value != null}
				<button
					type="button"
					class="inline-flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent"
					aria-label={t.expenses.clearPlace}
					onclick={() => choose(null)}
				>
					<X class="size-4" />
				</button>
			{/if}
			<Combobox.Trigger
				class="inline-flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent"
			>
				<ChevronsUpDown class="size-4" />
			</Combobox.Trigger>
		</div>
	</div>
	<Combobox.Portal>
		<Combobox.Content
			sideOffset={4}
			class="z-[60] max-h-[min(20rem,var(--bits-combobox-content-available-height))] w-(--bits-combobox-anchor-width) overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
		>
			{#each filtered as p (p.id)}
				<Combobox.Item
					value={String(p.id)}
					label={p.name}
					class="flex cursor-pointer flex-col rounded-sm px-2 py-1.5 text-sm outline-none select-none data-highlighted:bg-accent data-selected:font-medium"
				>
					<span class="flex items-center gap-2">
						<span class="truncate">{p.name}</span>
						{#if p.distance != null}
							<span class="ml-auto shrink-0 text-xs text-muted-foreground"
								>{formatDistance(p.distance)}</span
							>
						{/if}
					</span>
					{#if p.address}<span class="truncate text-xs text-muted-foreground">{p.address}</span
						>{/if}
				</Combobox.Item>
			{/each}
			<Combobox.Item
				value={CREATE}
				label={query}
				class="mt-1 flex cursor-pointer items-center gap-2 rounded-sm border-t px-2 py-2 text-sm font-medium outline-none select-none data-highlighted:bg-accent"
			>
				<Plus class="size-4" />
				{query.trim() && !(selected && normalize(query) === normalize(selected.name))
					? t.expenses.createPlace.replace('{name}', query.trim())
					: t.expenses.createPlaceEmpty}
			</Combobox.Item>
		</Combobox.Content>
	</Combobox.Portal>
</Combobox.Root>

<PlaceSheet
	bind:open={sheetOpen}
	initial={{ name: draftName }}
	{budgets}
	onSaved={(place) => {
		places = [...places, place].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
		choose(place);
	}}
/>
