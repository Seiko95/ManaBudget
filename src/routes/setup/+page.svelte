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

<svelte:head><title>{t.auth.setupTitle} · {t.app.name}</title></svelte:head>

<AuthCard title={t.auth.setupTitle} intro={t.auth.setupIntro}>
	<form
		method="POST"
		class="space-y-4"
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				await update({ reset: false });
				busy = false;
			};
		}}
	>
		<FormError message={form?.error} />
		<div class="space-y-1.5">
			<Label for="displayName">{t.auth.displayName}</Label>
			<Input id="displayName" name="displayName" required value={form?.values?.displayName ?? ''} />
		</div>
		<div class="space-y-1.5">
			<Label for="username">{t.auth.username}</Label>
			<Input
				id="username"
				name="username"
				required
				autocapitalize="none"
				autocomplete="username"
				value={form?.values?.username ?? ''}
			/>
		</div>
		<div class="space-y-1.5">
			<Label for="password">{t.auth.password}</Label>
			<Input
				id="password"
				name="password"
				type="password"
				required
				minlength={8}
				autocomplete="new-password"
			/>
		</div>
		<div class="space-y-1.5">
			<Label for="passwordConfirm">{t.auth.passwordConfirm}</Label>
			<Input
				id="passwordConfirm"
				name="passwordConfirm"
				type="password"
				required
				minlength={8}
				autocomplete="new-password"
			/>
		</div>
		<Button type="submit" class="w-full" disabled={busy}>{t.auth.setupSubmit}</Button>
	</form>
</AuthCard>
