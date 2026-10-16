<script lang="ts">
	import NativeSelect from './NativeSelect.svelte';
	import type { BudgetOption } from '$lib/types';
	import { t } from '$lib/i18n/fr';

	let {
		budgets,
		value = $bindable(null),
		id,
		name,
		allowNone = true
	}: {
		budgets: BudgetOption[];
		value?: number | null;
		id?: string;
		name?: string;
		allowNone?: boolean;
	} = $props();
</script>

<NativeSelect
	{id}
	{name}
	value={value ?? ''}
	onchange={(e) => {
		const v = (e.currentTarget as HTMLSelectElement).value;
		value = v ? Number(v) : null;
	}}
>
	{#if allowNone}<option value="">{t.common.none}</option>{/if}
	{#each budgets as b (b.id)}
		<optgroup label="{b.icon} {b.name}">
			{#each b.categories as c (c.id)}
				<option value={c.id}>{c.icon ? `${c.icon} ` : ''}{c.name}</option>
			{/each}
		</optgroup>
	{/each}
</NativeSelect>
