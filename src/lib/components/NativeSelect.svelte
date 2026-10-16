<script lang="ts">
	import type { HTMLSelectAttributes } from 'svelte/elements';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';

	let {
		value = $bindable(),
		class: className = '',
		children,
		...rest
	}: HTMLSelectAttributes = $props();
</script>

<div class="relative">
	<select
		bind:value
		class="h-9 w-full appearance-none rounded-md border border-input bg-transparent py-1 pr-8 pl-2.5 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30 {className}"
		{...rest}
	>
		{@render children?.()}
	</select>
	<ChevronDown
		class="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
	/>
</div>
