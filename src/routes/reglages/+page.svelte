<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import NativeSelect from '$lib/components/NativeSelect.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { enhanceWithToast } from '$lib/forms';
	import { periodFor, periodLabelText, periodRangeText, todayISO } from '$lib/periods';
	import { t } from '$lib/i18n/fr';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let startDay = $state(untrack(() => data.monthStartDay));
	const preview = $derived(periodFor(todayISO(), Number(startDay)));
</script>

<svelte:head><title>{t.settings.title} · {t.app.name}</title></svelte:head>

<PageHeader title={t.settings.title} />

<div class="grid max-w-3xl gap-6 px-4 pb-10 lg:px-8">
	<form
		method="POST"
		action="?/profile"
		class="space-y-5 rounded-xl border bg-card p-5"
		use:enhance={enhanceWithToast({ reset: false })}
	>
		<h2 class="font-semibold">{t.settings.profile}</h2>
		<div class="space-y-1.5">
			<Label for="displayName">{t.auth.displayName}</Label>
			<Input id="displayName" name="displayName" required maxlength={60} value={data.displayName} />
		</div>
		<div class="space-y-1.5">
			<Label for="monthStartDay">{t.settings.monthStartDay}</Label>
			<NativeSelect id="monthStartDay" name="monthStartDay" bind:value={startDay} class="max-w-40">
				{#each Array.from({ length: 28 }, (_, i) => i + 1) as n (n)}
					<option value={n}>{t.settings.dayN.replace('{n}', String(n))}</option>
				{/each}
			</NativeSelect>
			<p class="text-xs text-muted-foreground">{t.settings.monthStartHelp}</p>
			<p class="text-sm" data-testid="period-preview">
				<span class="font-medium">{periodLabelText(preview.label)}</span>
				<span class="text-muted-foreground">: {periodRangeText(preview)}</span>
			</p>
		</div>
		<Button type="submit">{t.common.save}</Button>
	</form>

	<form
		method="POST"
		action="?/password"
		class="space-y-5 rounded-xl border bg-card p-5"
		use:enhance={enhanceWithToast()}
	>
		<h2 class="font-semibold">{t.settings.changePassword}</h2>
		<div class="space-y-1.5">
			<Label for="currentPassword">{t.settings.currentPassword}</Label>
			<Input
				id="currentPassword"
				name="currentPassword"
				type="password"
				required
				autocomplete="current-password"
			/>
		</div>
		<div class="space-y-1.5">
			<Label for="newPassword">{t.settings.newPassword}</Label>
			<Input
				id="newPassword"
				name="newPassword"
				type="password"
				required
				minlength={8}
				autocomplete="new-password"
			/>
		</div>
		<div class="space-y-1.5">
			<Label for="newPasswordConfirm">{t.auth.passwordConfirm}</Label>
			<Input
				id="newPasswordConfirm"
				name="newPasswordConfirm"
				type="password"
				required
				minlength={8}
				autocomplete="new-password"
			/>
		</div>
		<Button type="submit">{t.settings.changePassword}</Button>
	</form>
</div>
