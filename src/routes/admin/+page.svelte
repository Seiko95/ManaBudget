<script lang="ts">
	import { enhance } from '$app/forms';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import FormSheet from '$lib/components/FormSheet.svelte';
	import ConfirmAction from '$lib/components/ConfirmAction.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { enhanceWithToast } from '$lib/forms';
	import { formatNumericDate } from '$lib/format';
	import { t } from '$lib/i18n/fr';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let createOpen = $state(false);
	let resetFor = $state<{ id: number; name: string } | null>(null);
	let busy = $state(false);

	const isoDate = (d: Date | string) => new Date(d).toISOString().slice(0, 10);
</script>

<svelte:head><title>{t.admin.title} · {t.app.name}</title></svelte:head>

<PageHeader title={t.admin.title} subtitle={t.admin.subtitle}>
	{#snippet actions()}
		<Button onclick={() => (createOpen = true)}><UserPlus />{t.admin.newUser}</Button>
	{/snippet}
</PageHeader>

<ul class="mx-4 divide-y rounded-xl border bg-card lg:mx-8">
	{#each data.users as u (u.id)}
		<li class="flex flex-wrap items-center gap-3 px-4 py-3" data-testid="user-row">
			<div class="min-w-0 flex-1 basis-56">
				<p class="font-medium">
					{u.displayName}
					{#if u.id === data.meId}<span class="text-sm text-muted-foreground">({t.admin.you})</span
						>{/if}
				</p>
				<p class="text-sm text-muted-foreground">
					@{u.username} · {t.admin.createdAt.replace(
						'{date}',
						formatNumericDate(isoDate(u.createdAt))
					)}
				</p>
			</div>
			<div class="flex flex-wrap items-center gap-2">
				{#if u.isAdmin}<Badge variant="secondary">{t.admin.adminBadge}</Badge>{/if}
				{#if u.disabled}<Badge variant="destructive">{t.admin.disabledBadge}</Badge>{/if}
				<Button
					size="sm"
					variant="outline"
					onclick={() => (resetFor = { id: u.id, name: u.displayName })}
				>
					{t.admin.resetPassword}
				</Button>
				{#if u.id !== data.meId}
					<form method="POST" action="?/toggle" use:enhance={enhanceWithToast()}>
						<input type="hidden" name="id" value={u.id} />
						<Button size="sm" variant="outline" type="submit">
							{u.disabled ? t.admin.enable : t.admin.disable}
						</Button>
					</form>
					<ConfirmAction
						action="?/delete"
						fields={{ id: u.id }}
						title={t.admin.deleteUser}
						message={t.admin.deleteConfirm.replace('{name}', u.displayName)}
						submit={enhanceWithToast()}
					>
						{t.common.delete}
					</ConfirmAction>
				{/if}
			</div>
		</li>
	{/each}
</ul>

<FormSheet bind:open={createOpen} title={t.admin.newUser}>
	<form
		method="POST"
		action="?/create"
		class="space-y-4"
		id="create-user"
		use:enhance={enhanceWithToast({
			busy: (v) => (busy = v),
			onSuccess: () => (createOpen = false)
		})}
	>
		<div class="space-y-1.5">
			<Label for="new-displayName">{t.auth.displayName}</Label>
			<Input id="new-displayName" name="displayName" required />
		</div>
		<div class="space-y-1.5">
			<Label for="new-username">{t.auth.username}</Label>
			<Input id="new-username" name="username" required autocapitalize="none" autocomplete="off" />
		</div>
		<div class="space-y-1.5">
			<Label for="new-password">{t.auth.password}</Label>
			<Input
				id="new-password"
				name="password"
				type="password"
				required
				minlength={8}
				autocomplete="new-password"
			/>
		</div>
		<div class="flex items-center gap-2">
			<Checkbox id="new-isAdmin" name="isAdmin" />
			<Label for="new-isAdmin">{t.admin.isAdmin}</Label>
		</div>
	</form>
	{#snippet footer()}
		<Button type="submit" form="create-user" class="w-full" disabled={busy}
			>{t.common.create}</Button
		>
	{/snippet}
</FormSheet>

<FormSheet
	open={resetFor !== null}
	onOpenChange={(o) => {
		if (!o) resetFor = null;
	}}
	title={t.admin.resetPassword}
	description={resetFor?.name}
>
	<form
		method="POST"
		action="?/reset"
		class="space-y-4"
		id="reset-password"
		use:enhance={enhanceWithToast({
			busy: (v) => (busy = v),
			onSuccess: () => (resetFor = null)
		})}
	>
		<input type="hidden" name="id" value={resetFor?.id ?? ''} />
		<div class="space-y-1.5">
			<Label for="reset-password-input">{t.admin.newPassword}</Label>
			<Input
				id="reset-password-input"
				name="password"
				type="password"
				required
				minlength={8}
				autocomplete="new-password"
			/>
		</div>
	</form>
	{#snippet footer()}
		<Button type="submit" form="reset-password" class="w-full" disabled={busy}
			>{t.common.save}</Button
		>
	{/snippet}
</FormSheet>
