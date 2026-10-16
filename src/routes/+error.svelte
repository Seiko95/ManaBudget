<script lang="ts">
	import { page } from '$app/state';
	import { t } from '$lib/i18n/fr';

	const messages: Record<number, string> = {
		401: t.errors.unauthorized,
		403: t.errors.forbidden,
		404: t.errors.notFound
	};
</script>

<svelte:head><title>{page.status} · {t.app.name}</title></svelte:head>

<div class="mx-auto max-w-md px-4 py-16 text-center">
	<p class="text-5xl font-bold text-muted-foreground">{page.status}</p>
	<h1 class="mt-4 text-xl font-semibold">
		{messages[page.status] ?? page.error?.message ?? t.common.error}
	</h1>
	{#if page.error?.message && messages[page.status] && page.error.message !== messages[page.status]}
		<p class="mt-2 text-sm text-muted-foreground">{page.error.message}</p>
	{/if}
	<a href="/" class="mt-6 inline-block text-sm font-medium underline">{t.errors.home}</a>
</div>
