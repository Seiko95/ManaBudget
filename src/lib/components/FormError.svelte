<script lang="ts">
	let { message }: { message?: string | null } = $props();
</script>

{#if message}
	<p
		role="alert"
		class="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
	>
		{message}
	</p>
{/if}
