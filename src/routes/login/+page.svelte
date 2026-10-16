<script lang="ts">
	import { enhance } from '$app/forms';
	import AuthCard from '$lib/components/AuthCard.svelte';
	import FormError from '$lib/components/FormError.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { t } from '$lib/i18n/fr';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let busy = $state(false);
</script>

<svelte:head><title>{t.auth.loginTitle} · {t.app.name}</title></svelte:head>

<AuthCard title={t.auth.loginTitle}>
	<form
		method="POST"
		class="space-y-4"
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				await update();
				busy = false;
			};
		}}
	>
		<FormError message={form?.error} />
		<div class="space-y-1.5">
			<Label for="username">{t.auth.username}</Label>
			<Input
				id="username"
				name="username"
				required
				autocapitalize="none"
				autocomplete="username"
				value={form?.username ?? ''}
			/>
		</div>
		<div class="space-y-1.5">
			<Label for="password">{t.auth.password}</Label>
			<Input
				id="password"
				name="password"
				type="password"
				required
				autocomplete="current-password"
			/>
		</div>
		<Button type="submit" class="w-full" disabled={busy}>{t.auth.login}</Button>
	</form>
</AuthCard>
