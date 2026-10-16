<script lang="ts">
	import './layout.css';
	import { Toaster } from '$lib/components/ui/sonner';
	import AppShell from '$lib/components/AppShell.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

{#if data.user}
	<AppShell user={data.user} alertCount={data.alertCount}>
		{@render children()}
	</AppShell>
{:else}
	{@render children()}
{/if}

<Toaster position="top-center" richColors closeButton />
