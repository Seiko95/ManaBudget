<script lang="ts">
	import { page } from '$app/state';
	import Search from '@lucide/svelte/icons/search';
	import LocateFixed from '@lucide/svelte/icons/locate-fixed';
	import X from '@lucide/svelte/icons/x';
	import FormSheet from './FormSheet.svelte';
	import MapView from './MapView.svelte';
	import CategorySelect from './CategorySelect.svelte';
	import FormError from './FormError.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { locate } from '$lib/geolocation.svelte';
	import type { LatLng } from '$lib/geo';
	import type { BudgetOption, PlaceOption } from '$lib/types';
	import { t } from '$lib/i18n/fr';

	let {
		open = $bindable(false),
		initial = null,
		budgets,
		onSaved
	}: {
		open?: boolean;
		/** Existing place to edit, or a partial one (e.g. a prefilled name) to create. */
		initial?: Partial<PlaceOption> | null;
		budgets: BudgetOption[];
		onSaved: (place: PlaceOption) => void;
	} = $props();

	let name = $state('');
	let address = $state('');
	let pin = $state<LatLng | null>(null);
	let defaultCategoryId = $state<number | null>(null);
	let results = $state<{ label: string; lat: number; lng: number }[] | null>(null);
	let searching = $state(false);
	let locating = $state(false);
	let saving = $state(false);
	let error = $state<string | null>(null);
	let notice = $state<string | null>(null);

	const geocoding = $derived(page.data.map?.geocodingEnabled ?? false);
	const editingId = $derived(initial?.id);

	// Reset the fields every time the sheet opens.
	$effect(() => {
		if (open) {
			name = initial?.name ?? '';
			address = initial?.address ?? '';
			pin =
				initial?.lat != null && initial?.lng != null
					? { lat: initial.lat, lng: initial.lng }
					: null;
			defaultCategoryId = initial?.defaultCategoryId ?? null;
			results = null;
			error = null;
			notice = null;
		}
	});

	async function search() {
		const q = (address || name).trim();
		if (q.length < 3) return;
		searching = true;
		notice = null;
		try {
			const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
			if (!res.ok) throw new Error();
			results = (await res.json()).results;
		} catch {
			notice = t.places.geocodingError;
			results = null;
		} finally {
			searching = false;
		}
	}

	function pick(r: { label: string; lat: number; lng: number }) {
		address = r.label;
		pin = { lat: r.lat, lng: r.lng };
		results = null;
	}

	async function useMyPosition() {
		locating = true;
		notice = null;
		const pos = await locate();
		locating = false;
		if (!pos) {
			notice = t.places.locationDenied;
			return;
		}
		pin = pos;
		if (geocoding && !address.trim()) {
			try {
				const res = await fetch(`/api/geocode/reverse?lat=${pos.lat}&lng=${pos.lng}`);
				if (res.ok) {
					const { result } = await res.json();
					if (result?.label) address = result.label;
				}
			} catch {
				// Address stays empty; the position is what matters.
			}
		}
	}

	async function save(e: SubmitEvent) {
		e.preventDefault();
		saving = true;
		error = null;
		try {
			const res = await fetch(editingId ? `/api/places/${editingId}` : '/api/places', {
				method: editingId ? 'PUT' : 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					name,
					address,
					lat: pin?.lat ?? null,
					lng: pin?.lng ?? null,
					defaultCategoryId
				})
			});
			if (!res.ok) {
				error = (await res.json().catch(() => null))?.message ?? t.common.error;
				return;
			}
			const { place } = await res.json();
			open = false;
			onSaved(place);
		} finally {
			saving = false;
		}
	}

	const formId = `place-form-${Math.random().toString(36).slice(2)}`;
</script>

<FormSheet bind:open title={editingId ? t.places.editPlace : t.places.newPlace}>
	<form id={formId} class="space-y-5" onsubmit={save}>
		<FormError message={error} />
		<div class="space-y-1.5">
			<Label for="{formId}-name">{t.places.name}</Label>
			<Input id="{formId}-name" bind:value={name} required maxlength={100} />
		</div>
		<div class="space-y-1.5">
			<Label for="{formId}-address">{t.places.address}</Label>
			<div class="flex gap-2">
				<Input
					id="{formId}-address"
					bind:value={address}
					maxlength={300}
					onkeydown={(e) => {
						if (e.key === 'Enter' && geocoding) {
							e.preventDefault();
							search();
						}
					}}
				/>
				{#if geocoding}
					<Button
						type="button"
						variant="outline"
						onclick={search}
						disabled={searching || (address || name).trim().length < 3}
						aria-label={t.places.searchAddress}
						title={t.places.searchAddress}
					>
						<Search />
					</Button>
				{/if}
			</div>
			{#if !geocoding}
				<p class="text-xs text-muted-foreground">{t.places.geocodingDisabled}</p>
			{/if}
			{#if searching}<p class="text-sm text-muted-foreground">{t.places.searching}</p>{/if}
			{#if results}
				<ul class="divide-y rounded-md border" role="listbox" aria-label={t.places.searchAddress}>
					{#each results as r (r.label + r.lat)}
						<li>
							<button
								type="button"
								class="w-full px-3 py-2 text-left text-sm hover:bg-accent"
								onclick={() => pick(r)}>{r.label}</button
							>
						</li>
					{:else}
						<li class="px-3 py-2 text-sm text-muted-foreground">{t.places.noResults}</li>
					{/each}
				</ul>
			{/if}
		</div>
		<div class="space-y-2">
			<div class="flex flex-wrap items-center gap-2">
				<Button
					type="button"
					variant="outline"
					size="sm"
					onclick={useMyPosition}
					disabled={locating}
				>
					<LocateFixed />{locating ? t.places.locating : t.places.useMyPosition}
				</Button>
				{#if pin}
					<Button type="button" variant="ghost" size="sm" onclick={() => (pin = null)}>
						<X />{t.places.clearPosition}
					</Button>
				{/if}
			</div>
			{#if notice}<p class="text-sm text-destructive">{notice}</p>{/if}
			{#if open}
				<MapView bind:pin editable class="h-56" label={t.places.map} />
			{/if}
			<p class="text-xs text-muted-foreground">
				{pin ? t.places.dragPin : t.places.noPosition}
			</p>
		</div>
		<div class="space-y-1.5">
			<Label for="{formId}-cat">{t.places.defaultCategory}</Label>
			<CategorySelect id="{formId}-cat" {budgets} bind:value={defaultCategoryId} />
			<p class="text-xs text-muted-foreground">{t.places.defaultCategoryHelp}</p>
		</div>
	</form>
	{#snippet footer()}
		<Button type="submit" form={formId} class="w-full" disabled={saving}>{t.common.save}</Button>
	{/snippet}
</FormSheet>
