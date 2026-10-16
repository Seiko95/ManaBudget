<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Pencil from '@lucide/svelte/icons/pencil';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import Repeat from '@lucide/svelte/icons/repeat';
	import { enhance } from '$app/forms';
	import ConfirmAction from '$lib/components/ConfirmAction.svelte';
	import NativeSelect from '$lib/components/NativeSelect.svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { enhanceWithToast } from '$lib/forms';
	import Lightbox from '$lib/components/Lightbox.svelte';
	import { Button } from '$lib/components/ui/button';
	import { formatCents, formatDay } from '$lib/format';
	import { openEditExpense } from '$lib/stores/ui.svelte';
	import { t } from '$lib/i18n/fr';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const e = $derived(data.expense);
	let photoIndex = $state<number | null>(null);
	let recurringOpen = $state(false);
</script>

<svelte:head><title>{t.expenses.detail} · {t.app.name}</title></svelte:head>

<div class="mx-auto max-w-2xl px-4 pt-4 pb-10 lg:px-8 lg:pt-8">
	<div class="mb-4 flex items-center justify-between gap-2">
		<Button
			variant="ghost"
			size="sm"
			href="/depenses"
			onclick={(ev) => {
				if (history.length > 1) {
					ev.preventDefault();
					history.back();
				}
			}}
		>
			<ArrowLeft />{t.common.back}
		</Button>
		<div class="flex gap-2">
			<Button variant="outline" size="sm" onclick={() => openEditExpense(e.id)}>
				<Pencil />{t.common.edit}
			</Button>
			<ConfirmAction action="?/delete" title={t.common.delete} message={t.expenses.deleteConfirm}>
				{t.common.delete}
			</ConfirmAction>
		</div>
	</div>

	<div class="rounded-xl border bg-card p-5">
		<p class="text-3xl font-bold tabular-nums" data-testid="expense-total">
			{formatCents(e.totalCents)}
		</p>
		<p class="mt-1 text-sm text-muted-foreground first-letter:uppercase">{formatDay(e.date)}</p>
		{#if e.place}
			<p class="mt-3 flex items-start gap-2">
				<MapPin class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
				<span>
					<span class="font-medium">{e.place.name}</span>
					{#if e.place.address}<span class="block text-sm text-muted-foreground"
							>{e.place.address}</span
						>{/if}
				</span>
			</p>
		{/if}
		{#if e.description}<p class="mt-3 whitespace-pre-line">{e.description}</p>{/if}
		{#if e.recurringRuleId}
			<a
				href="/recurrents"
				class="mt-3 flex items-center gap-2 text-sm text-muted-foreground underline"
			>
				<Repeat class="size-4" />{t.expenses.recurringFrom}
			</a>
		{:else}
			<Button variant="outline" size="sm" class="mt-4" onclick={() => (recurringOpen = true)}>
				<Repeat />{t.recurring.makeRecurring}
			</Button>
		{/if}
	</div>

	<section class="mt-4 rounded-xl border bg-card">
		<h2 class="border-b px-5 py-3 text-sm font-semibold">{t.expenses.splitDetail}</h2>
		<ul class="divide-y">
			{#each e.splits as s (s.categoryId)}
				<li class="flex items-center gap-3 px-5 py-3" data-testid="split-line">
					<span class="size-3 shrink-0 rounded-full" style="background-color: {s.budgetColor}"
					></span>
					<span class="min-w-0 flex-1">
						<span class="font-medium">{s.categoryName}</span>
						<span class="block text-sm text-muted-foreground">{s.budgetIcon} {s.budgetName}</span>
					</span>
					<span class="tabular-nums">{formatCents(s.amountCents)}</span>
				</li>
			{/each}
		</ul>
	</section>

	{#if e.tags.length}
		<div class="mt-4 flex flex-wrap gap-1.5">
			{#each e.tags as tag (tag.id)}
				<a
					href="/depenses?periode=tout&etiquette={tag.id}"
					class="rounded-full px-2.5 py-0.5 text-sm"
					style="background-color: color-mix(in oklab, {tag.color} 20%, transparent)">{tag.name}</a
				>
			{/each}
		</div>
	{/if}

	{#if e.photos.length}
		<section class="mt-4">
			<h2 class="mb-2 text-sm font-semibold">{t.expenses.photos}</h2>
			<div class="grid grid-cols-3 gap-2 sm:grid-cols-4">
				{#each e.photos as p, i (p.id)}
					<button
						type="button"
						class="overflow-hidden rounded-lg border"
						onclick={() => (photoIndex = i)}
						aria-label={t.expenses.photo.replace('{n}', String(i + 1))}
					>
						<img
							src="/photos/{p.id}?thumb"
							alt=""
							class="aspect-square w-full object-cover"
							loading="lazy"
						/>
					</button>
				{/each}
			</div>
		</section>
	{/if}
</div>

<Lightbox photos={e.photos} bind:index={photoIndex} />

<Dialog.Root bind:open={recurringOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{t.recurring.makeRecurring}</Dialog.Title>
		</Dialog.Header>
		<form
			id="make-recurring"
			method="POST"
			action="?/makeRecurring"
			class="space-y-4"
			use:enhance={enhanceWithToast({ onSuccess: () => (recurringOpen = false) })}
		>
			<div class="space-y-1.5">
				<Label for="mr-frequency">{t.recurring.frequency}</Label>
				<NativeSelect id="mr-frequency" name="frequency" value="monthly">
					<option value="monthly">{t.recurring.monthly}</option>
					<option value="weekly">{t.recurring.weekly}</option>
					<option value="yearly">{t.recurring.yearly}</option>
				</NativeSelect>
			</div>
			<div class="space-y-1.5">
				<Label for="mr-end">{t.recurring.endDate}</Label>
				<Input id="mr-end" name="endDate" type="date" />
			</div>
		</form>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (recurringOpen = false)}>{t.common.cancel}</Button>
			<Button type="submit" form="make-recurring">{t.common.save}</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
