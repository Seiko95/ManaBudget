<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import { BUDGET_PALETTE } from '$lib/colors';

	let {
		name = 'color',
		value = $bindable(BUDGET_PALETTE[0].light),
		label
	}: { name?: string; value?: string; label: string } = $props();
</script>

<fieldset>
	<legend class="mb-1.5 text-sm font-medium">{label}</legend>
	<div class="flex flex-wrap gap-2">
		{#each BUDGET_PALETTE as c (c.light)}
			<label
				class="relative inline-flex size-9 cursor-pointer items-center justify-center rounded-full ring-offset-2 ring-offset-background has-checked:ring-2 has-checked:ring-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring"
				style="background-color: {c.light}"
				title={c.name}
			>
				<input type="radio" {name} value={c.light} bind:group={value} class="sr-only" />
				<span class="sr-only">{c.name}</span>
				{#if value === c.light}<Check class="size-4 text-white" />{/if}
			</label>
		{/each}
	</div>
</fieldset>
