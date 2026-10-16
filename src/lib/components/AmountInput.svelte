<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import type { HTMLInputAttributes } from 'svelte/elements';

	/** Euro amount field: numeric keypad on phones, accepts "12,50". */
	let {
		value = $bindable(''),
		class: className = '',
		...rest
	}: Omit<HTMLInputAttributes, 'value' | 'type' | 'files'> & { value?: string } = $props();
</script>

<div class="relative">
	<Input
		type="text"
		inputmode="decimal"
		autocomplete="off"
		pattern={'-?[0-9 ]*([.,][0-9]{0,2})?'}
		placeholder="0,00"
		bind:value
		class="pr-8 text-right tabular-nums {className}"
		{...rest}
	/>
	<span
		class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground"
		>€</span
	>
</div>
