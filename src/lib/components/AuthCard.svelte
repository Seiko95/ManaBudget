<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t } from '$lib/i18n/fr';

	let { title, intro, children }: { title: string; intro?: string; children: Snippet } = $props();
</script>

<div class="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-10">
	<div class="w-full max-w-sm">
		<p class="mb-6 text-center text-2xl font-bold tracking-tight">{t.app.name}</p>
		<div class="rounded-xl border bg-card p-6 shadow-sm">
			<h1 class="text-lg font-semibold">{title}</h1>
			{#if intro}<p class="mt-1 text-sm text-muted-foreground">{intro}</p>{/if}
			<div class="mt-5">{@render children()}</div>
		</div>
	</div>
</div>
