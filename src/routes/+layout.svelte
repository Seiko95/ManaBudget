<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { Toaster } from '$lib/components/ui/sonner';
	import AppShell from '$lib/components/AppShell.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if data.user}
	<AppShell user={data.user}>
		{@render children()}
	</AppShell>
{:else}
	{@render children()}
{/if}

<Toaster position="top-center" richColors closeButton />
