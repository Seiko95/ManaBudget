<script lang="ts">
	import { t } from '$lib/i18n/fr';
</script>

<svelte:head><title>{t.app.name}</title></svelte:head>

<main class="mx-auto max-w-xl p-6">
	<h1 class="text-2xl font-semibold">{t.app.name}</h1>
	<p class="text-muted-foreground">{t.app.tagline}</p>
</main>
