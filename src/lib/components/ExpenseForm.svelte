<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import Camera from '@lucide/svelte/icons/camera';
	import ImagePlus from '@lucide/svelte/icons/image-plus';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash from '@lucide/svelte/icons/trash-2';
	import X from '@lucide/svelte/icons/x';
	import AmountInput from './AmountInput.svelte';
	import PlacePicker from './PlacePicker.svelte';
	import CategoryPicker from './CategoryPicker.svelte';
	import TagInput from './TagInput.svelte';
	import FormError from './FormError.svelte';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Button } from '$lib/components/ui/button';
	import { centsToInput, formatCents, parseAmountToCents } from '$lib/format';
	import { todayISO } from '$lib/periods';
	import { remainingCents, validateSplits } from '$lib/splits';
	import { shrinkImage } from '$lib/image';
	import { locateIfGranted } from '$lib/geolocation.svelte';
	import type { BudgetOption, PlaceOption, TagOption } from '$lib/types';
	import { t } from '$lib/i18n/fr';

	type Initial = {
		id: number;
		date: string;
		totalCents: number;
		placeId: number | null;
		description: string;
		splits: { categoryId: number; amountCents: number }[];
		tags: { name: string }[];
		photos: { id: number }[];
	};

	let {
		budgets,
		places: initialPlaces,
		tags: tagOptions,
		initial = null,
		formId,
		onSaving,
		onDone
	}: {
		budgets: BudgetOption[];
		places: PlaceOption[];
		tags: TagOption[];
		initial?: Initial | null;
		formId: string;
		onSaving?: (saving: boolean) => void;
		onDone: (id: number) => void;
	} = $props();

	// Form state, seeded once from `initial`.
	const init = untrack(() => initial);
	let places = $state(untrack(() => [...initialPlaces]));
	let amount = $state(init ? centsToInput(init.totalCents) : '');
	let date = $state(init?.date ?? todayISO());
	let placeId = $state<number | null>(init?.placeId ?? null);
	let splitMode = $state((init?.splits.length ?? 0) > 1);
	let categoryId = $state<number | null>(init?.splits[0]?.categoryId ?? null);
	let categoryAuto = $state(false);
	let splits = $state(
		(init?.splits ?? []).map((s) => ({
			categoryId: s.categoryId as number | null,
			amount: centsToInput(s.amountCents)
		}))
	);
	let tags = $state<string[]>(init?.tags.map((x) => x.name) ?? []);
	let description = $state(init?.description ?? '');
	let existingPhotos = $state(init?.photos ?? []);
	let removedPhotoIds = $state<number[]>([]);
	let newPhotos = $state<{ blob: Blob; url: string }[]>([]);
	let processing = $state(false);
	let error = $state<string | null>(null);

	const totalCents = $derived(parseAmountToCents(amount));
	const allCategories = $derived(
		budgets.flatMap((b) => b.categories.map((c) => ({ ...c, budget: b })))
	);
	const selectedBudget = $derived(allCategories.find((c) => c.id === categoryId)?.budget ?? null);
	const remaining = $derived(
		remainingCents(
			totalCents ?? 0,
			splits.map((s) => ({ amountCents: parseAmountToCents(s.amount) }))
		)
	);

	onMount(() => {
		locateIfGranted();
		return () => newPhotos.forEach((p) => URL.revokeObjectURL(p.url));
	});

	function onPlace(place: PlaceOption | null) {
		// Fill the category from the place's default, unless the user chose one.
		if (place?.defaultCategoryId && !splitMode && (categoryId == null || categoryAuto)) {
			if (allCategories.some((c) => c.id === place.defaultCategoryId)) {
				categoryId = place.defaultCategoryId;
				categoryAuto = true;
			}
		}
	}

	function toggleSplit(on: boolean) {
		splitMode = on;
		if (on) {
			splits = [
				{ categoryId, amount: totalCents ? centsToInput(totalCents) : '' },
				{ categoryId: null, amount: '' }
			];
		} else {
			categoryId = splits[0]?.categoryId ?? categoryId;
		}
	}

	async function addFiles(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const files = Array.from(input.files ?? []);
		input.value = '';
		if (!files.length) return;
		processing = true;
		for (const f of files) {
			const blob = await shrinkImage(f);
			newPhotos.push({ blob, url: URL.createObjectURL(blob) });
		}
		processing = false;
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		error = null;
		if (totalCents == null || totalCents <= 0) {
			error = t.expenses.amountPositive;
			return;
		}
		const outSplits = splitMode
			? splits.map((s) => ({ categoryId: s.categoryId, amountCents: parseAmountToCents(s.amount) }))
			: [{ categoryId, amountCents: totalCents }];
		const err = validateSplits(totalCents, outSplits);
		if (err) {
			error = err;
			return;
		}
		const body = new FormData();
		body.set(
			'data',
			JSON.stringify({ date, totalCents, placeId, description, splits: outSplits, tags })
		);
		body.set('removePhotoIds', JSON.stringify(removedPhotoIds));
		newPhotos.forEach((p, i) => body.append('photos', p.blob, `photo-${i}.jpg`));
		onSaving?.(true);
		try {
			const res = await fetch(init ? `/api/expenses/${init.id}` : '/api/expenses', {
				method: init ? 'PUT' : 'POST',
				body
			});
			const json = await res.json().catch(() => null);
			if (!res.ok) {
				error = json?.message ?? t.common.error;
				return;
			}
			toast.success(t.expenses.saved);
			for (const a of json.alerts ?? []) toast.warning(a, { duration: 8000 });
			onDone(json.id);
		} catch {
			error = t.common.error;
		} finally {
			onSaving?.(false);
		}
	}
</script>

<form id={formId} class="space-y-5" onsubmit={submit} novalidate>
	<FormError message={error} />

	<div class="grid grid-cols-2 gap-3">
		<div class="space-y-1.5">
			<Label for="{formId}-amount">{t.expenses.amount}</Label>
			<AmountInput
				id="{formId}-amount"
				bind:value={amount}
				required
				autofocus={!init}
				class="h-11 text-lg font-semibold"
			/>
		</div>
		<div class="space-y-1.5">
			<Label for="{formId}-date">{t.expenses.date}</Label>
			<Input id="{formId}-date" type="date" bind:value={date} required class="h-11" />
			{#if date > todayISO()}
				<p class="text-xs text-muted-foreground" data-testid="future-hint">
					{t.expenses.futureHint}
				</p>
			{/if}
		</div>
	</div>

	<div class="space-y-1.5">
		<Label for="{formId}-place">{t.expenses.place}</Label>
		<PlacePicker
			id="{formId}-place"
			bind:places
			bind:value={placeId}
			{budgets}
			onSelect={onPlace}
		/>
	</div>

	<div class="space-y-2">
		<div class="flex items-center justify-between gap-2">
			<Label for="{formId}-category"
				>{splitMode ? t.expenses.splitDetail : t.expenses.category}</Label
			>
			<label class="flex items-center gap-2 text-sm">
				<Switch
					checked={splitMode}
					onCheckedChange={toggleSplit}
					aria-label={t.expenses.splitHelp}
				/>
				{t.expenses.split}
			</label>
		</div>
		{#if !splitMode}
			<CategoryPicker
				id="{formId}-category"
				label={t.expenses.category}
				{budgets}
				bind:value={categoryId}
				onSelect={() => (categoryAuto = false)}
			/>
			{#if selectedBudget}
				<p
					class="flex items-center gap-1.5 text-sm text-muted-foreground"
					data-testid="selected-budget"
				>
					{t.expenses.budget} :
					<span class="size-2.5 rounded-full" style="background-color: {selectedBudget.color}"
					></span>
					<span class="font-medium text-foreground"
						>{selectedBudget.icon} {selectedBudget.name}</span
					>
				</p>
			{/if}
		{:else}
			<div class="space-y-2" data-testid="split-rows">
				{#each splits as s, i (i)}
					<div class="flex items-center gap-2">
						<div class="min-w-0 flex-1">
							<CategoryPicker
								label="{t.expenses.category} {i + 1}"
								{budgets}
								bind:value={s.categoryId}
							/>
						</div>
						<div class="w-28">
							<AmountInput bind:value={s.amount} aria-label="{t.expenses.amount} {i + 1}" />
						</div>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							aria-label={t.expenses.removeSplit}
							disabled={splits.length <= 1}
							onclick={() => splits.splice(i, 1)}
						>
							<Trash />
						</Button>
					</div>
				{/each}
				<div class="flex flex-wrap items-center justify-between gap-2">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onclick={() =>
							splits.push({
								categoryId: null,
								amount: remaining > 0 ? centsToInput(remaining) : ''
							})}
					>
						<Plus />{t.expenses.addSplit}
					</Button>
					<p
						class="text-sm font-medium {remaining === 0
							? 'text-muted-foreground'
							: 'text-destructive'}"
						data-testid="split-remaining"
						aria-live="polite"
					>
						{remaining === 0
							? t.expenses.splitDone
							: t.expenses.remaining.replace('{amount}', formatCents(remaining))}
					</p>
				</div>
			</div>
		{/if}
	</div>

	<div class="space-y-1.5">
		<Label for="{formId}-tags">{t.expenses.tags}</Label>
		<TagInput id="{formId}-tags" bind:value={tags} suggestions={tagOptions} />
	</div>

	<div class="space-y-1.5">
		<Label for="{formId}-description">{t.expenses.description}</Label>
		<Textarea id="{formId}-description" bind:value={description} rows={2} maxlength={1000} />
	</div>

	<div class="space-y-2">
		<p class="text-sm font-medium">{t.expenses.photos}</p>
		<div class="flex flex-wrap gap-2">
			{#each existingPhotos.filter((p) => !removedPhotoIds.includes(p.id)) as p (p.id)}
				<div class="relative">
					<img src="/photos/{p.id}?thumb" alt="" class="size-20 rounded-md border object-cover" />
					<button
						type="button"
						class="absolute -top-2 -right-2 inline-flex size-6 items-center justify-center rounded-full bg-foreground text-background"
						aria-label={t.expenses.removePhoto}
						onclick={() => removedPhotoIds.push(p.id)}
					>
						<X class="size-3.5" />
					</button>
				</div>
			{/each}
			{#each newPhotos as p, i (p.url)}
				<div class="relative">
					<img
						src={p.url}
						alt=""
						class="size-20 rounded-md border object-cover"
						data-testid="new-photo"
					/>
					<button
						type="button"
						class="absolute -top-2 -right-2 inline-flex size-6 items-center justify-center rounded-full bg-foreground text-background"
						aria-label={t.expenses.removePhoto}
						onclick={() => {
							URL.revokeObjectURL(p.url);
							newPhotos.splice(i, 1);
						}}
					>
						<X class="size-3.5" />
					</button>
				</div>
			{/each}
		</div>
		<div class="flex flex-wrap gap-2">
			<label
				class="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-sm font-medium hover:bg-muted has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
			>
				<Camera class="size-4" />{t.expenses.takePhoto}
				<input
					type="file"
					accept="image/*"
					capture="environment"
					class="sr-only"
					onchange={addFiles}
				/>
			</label>
			<label
				class="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-sm font-medium hover:bg-muted has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
			>
				<ImagePlus class="size-4" />{t.expenses.addPhotos}
				<input
					type="file"
					accept="image/*"
					multiple
					class="sr-only"
					onchange={addFiles}
					data-testid="photo-input"
				/>
			</label>
		</div>
		{#if processing}<p class="text-sm text-muted-foreground">{t.expenses.processingPhotos}</p>{/if}
	</div>
</form>
