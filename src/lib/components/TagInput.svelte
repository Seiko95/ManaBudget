<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import { normalize } from '$lib/text';
	import type { TagOption } from '$lib/types';
	import { t } from '$lib/i18n/fr';

	/** Chip input: pick existing tags or create one by typing a new name. */
	let {
		value = $bindable([]),
		suggestions,
		id
	}: { value?: string[]; suggestions: TagOption[]; id?: string } = $props();

	let query = $state('');
	let focused = $state(false);
	let highlighted = $state(0);

	const chosen = $derived(new Set(value.map(normalize)));
	const matches = $derived(
		suggestions
			.filter((s) => !chosen.has(normalize(s.name)))
			.filter((s) => !query.trim() || normalize(s.name).includes(normalize(query)))
			.slice(0, 8)
	);
	const canCreate = $derived(
		!!query.trim() &&
			!chosen.has(normalize(query)) &&
			!suggestions.some((s) => normalize(s.name) === normalize(query))
	);
	const options = $derived([
		...matches.map((m) => ({ name: m.name, create: false })),
		...(canCreate ? [{ name: query.trim(), create: true }] : [])
	]);
	const colorOf = (name: string) =>
		suggestions.find((s) => normalize(s.name) === normalize(name))?.color ?? '#64748b';

	function add(name: string) {
		const n = name.trim().slice(0, 40);
		if (n && !chosen.has(normalize(n))) value = [...value, n];
		query = '';
		highlighted = 0;
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ',') {
			if (!query.trim()) return;
			e.preventDefault();
			add(options[highlighted]?.name ?? query);
		} else if (e.key === 'Backspace' && !query && value.length) {
			value = value.slice(0, -1);
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			highlighted = Math.min(highlighted + 1, options.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			highlighted = Math.max(highlighted - 1, 0);
		} else if (e.key === 'Escape') {
			focused = false;
		}
	}
</script>

<div class="relative">
	<div
		class="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input px-2 py-1.5 shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30"
	>
		{#each value as tag (tag)}
			<span
				class="inline-flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2 text-xs font-medium"
				style="background-color: color-mix(in oklab, {colorOf(tag)} 20%, transparent)"
				data-testid="tag-chip"
			>
				{tag}
				<button
					type="button"
					class="inline-flex size-4 items-center justify-center rounded-full hover:bg-foreground/10"
					aria-label={t.expenses.removeTag.replace('{name}', tag)}
					onclick={() => (value = value.filter((v) => v !== tag))}
				>
					<X class="size-3" />
				</button>
			</span>
		{/each}
		<input
			{id}
			bind:value={query}
			{onkeydown}
			onfocus={() => (focused = true)}
			onblur={() => setTimeout(() => (focused = false), 150)}
			oninput={() => (highlighted = 0)}
			placeholder={value.length ? '' : t.expenses.tagsPlaceholder}
			class="min-w-24 flex-1 bg-transparent text-base outline-none md:text-sm"
			autocomplete="off"
			role="combobox"
			aria-expanded={focused && options.length > 0}
			aria-controls="{id}-list"
			aria-autocomplete="list"
		/>
	</div>
	{#if focused && options.length > 0}
		<ul
			id="{id}-list"
			role="listbox"
			class="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md"
		>
			{#each options as o, i (o.name + o.create)}
				<li role="option" aria-selected={i === highlighted}>
					<button
						type="button"
						class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm {i ===
						highlighted
							? 'bg-accent'
							: ''}"
						onmousedown={(e) => e.preventDefault()}
						onclick={() => add(o.name)}
					>
						{#if o.create}
							{t.expenses.createTag.replace('{name}', o.name)}
						{:else}
							<span class="size-2.5 rounded-full" style="background-color: {colorOf(o.name)}"
							></span>
							{o.name}
						{/if}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
