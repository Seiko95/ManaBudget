<script lang="ts">
	import { Combobox } from 'bits-ui';
	import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';
	import { normalize } from '$lib/text';
	import type { BudgetOption } from '$lib/types';
	import { t } from '$lib/i18n/fr';

	let {
		budgets,
		value = $bindable(null),
		id,
		label,
		onSelect
	}: {
		budgets: BudgetOption[];
		value?: number | null;
		id?: string;
		label?: string;
		onSelect?: (categoryId: number | null) => void;
	} = $props();

	let query = $state('');
	let open = $state(false);

	const all = $derived(budgets.flatMap((b) => b.categories.map((c) => ({ ...c, budget: b }))));
	const selected = $derived(all.find((c) => c.id === value) ?? null);
	const groups = $derived.by(() => {
		const q = normalize(query);
		const showAll = !q || (selected && q === normalize(selected.name));
		return budgets
			.map((b) => ({
				budget: b,
				categories: showAll
					? b.categories
					: b.categories.filter((c) => normalize(`${c.name} ${b.name}`).includes(q))
			}))
			.filter((g) => g.categories.length);
	});
	const items = $derived(all.map((c) => ({ value: String(c.id), label: c.name })));

	$effect(() => {
		if (!open) query = selected?.name ?? '';
	});
</script>

<Combobox.Root
	type="single"
	value={value != null ? String(value) : ''}
	onValueChange={(v) => {
		value = v ? Number(v) : null;
		query = all.find((c) => c.id === value)?.name ?? '';
		onSelect?.(value);
	}}
	bind:open
	{items}
	inputValue={query}
>
	<div class="relative">
		{#if selected}
			<span
				class="pointer-events-none absolute top-1/2 left-2.5 size-3 -translate-y-1/2 rounded-full"
				style="background-color: {selected.budget.color}"
				aria-hidden="true"
			></span>
		{/if}
		<Combobox.Input
			{id}
			aria-label={label}
			oninput={(e) => {
				query = e.currentTarget.value;
				open = true;
			}}
			onclick={() => (open = true)}
			placeholder={t.expenses.categoryPlaceholder}
			class="h-9 w-full rounded-md border border-input bg-transparent py-1 pr-9 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30 {selected
				? 'pl-7'
				: 'pl-2.5'}"
			autocomplete="off"
		/>
		<Combobox.Trigger
			class="absolute top-1/2 right-1 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-accent"
		>
			<ChevronsUpDown class="size-4" />
		</Combobox.Trigger>
	</div>
	<Combobox.Portal>
		<Combobox.Content
			sideOffset={4}
			class="z-[60] max-h-[min(22rem,var(--bits-combobox-content-available-height))] w-(--bits-combobox-anchor-width) min-w-56 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
		>
			{#each groups as g (g.budget.id)}
				<Combobox.Group>
					<Combobox.GroupHeading
						class="flex items-center gap-2 px-2 pt-2 pb-1 text-xs font-semibold text-muted-foreground"
					>
						<span class="size-2.5 rounded-full" style="background-color: {g.budget.color}"></span>
						{g.budget.icon}
						{g.budget.name}
					</Combobox.GroupHeading>
					{#each g.categories as c (c.id)}
						<Combobox.Item
							value={String(c.id)}
							label={c.name}
							class="flex cursor-pointer items-center gap-2 rounded-sm py-1.5 pr-2 pl-6 text-sm outline-none select-none data-highlighted:bg-accent data-selected:font-medium"
						>
							{#if c.icon}<span aria-hidden="true">{c.icon}</span>{/if}
							{c.name}
						</Combobox.Item>
					{/each}
				</Combobox.Group>
			{:else}
				<p class="px-2 py-3 text-sm text-muted-foreground">{t.places.noResults}</p>
			{/each}
		</Combobox.Content>
	</Combobox.Portal>
</Combobox.Root>
