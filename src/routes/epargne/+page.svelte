<script lang="ts">
	import { enhance } from '$app/forms';
	import ArrowLeftRight from '@lucide/svelte/icons/arrow-left-right';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import FormSheet from '$lib/components/FormSheet.svelte';
	import AmountInput from '$lib/components/AmountInput.svelte';
	import ConfirmAction from '$lib/components/ConfirmAction.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { enhanceWithToast } from '$lib/forms';
	import { centsToInput, formatCents, formatShortDate } from '$lib/format';
	import { todayISO } from '$lib/periods';
	import { t } from '$lib/i18n/fr';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Form = {
		id?: number;
		direction: 'deposit' | 'withdrawal';
		amount: string;
		date: string;
		description: string;
	};
	let form = $state<Form | null>(null);
	let busy = $state(false);
	const today = todayISO();
</script>

<svelte:head><title>{t.savings.title} · {t.app.name}</title></svelte:head>

<PageHeader title={t.savings.title} subtitle={t.savings.subtitle}>
	{#snippet actions()}
		<Button
			onclick={() =>
				(form = { direction: 'deposit', amount: '', date: todayISO(), description: '' })}
		>
			<ArrowLeftRight />{t.savings.newTransfer}
		</Button>
	{/snippet}
</PageHeader>

<div class="space-y-6 px-4 pb-8 lg:px-8">
	<div class="rounded-xl border bg-card p-4">
		<p class="text-sm text-muted-foreground">{t.savings.total}</p>
		<p class="mt-1 text-3xl font-semibold tabular-nums" data-testid="savings-total">
			{formatCents(data.total)}
		</p>
		<p class="mt-1 text-sm text-muted-foreground tabular-nums">
			{t.savings.available.replace('{amount}', formatCents(data.available))}
		</p>
	</div>

	<section>
		<h2 class="mb-2 font-semibold">{t.savings.history}</h2>
		{#if data.transfers.length === 0}
			<p class="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
				{t.savings.empty}
			</p>
		{:else}
			<ul class="divide-y rounded-xl border bg-card">
				{#each data.transfers as s (s.id)}
					<li class="flex items-center gap-3 px-4 py-3" data-testid="savings-row">
						<button
							type="button"
							class="min-w-0 flex-1 text-left"
							onclick={() =>
								(form = {
									id: s.id,
									direction: s.direction,
									amount: centsToInput(s.amountCents),
									date: s.date,
									description: s.description
								})}
						>
							<p class="font-medium">
								{s.direction === 'deposit' ? t.savings.depositShort : t.savings.withdrawalShort}
							</p>
							<p class="truncate text-sm text-muted-foreground">
								{formatShortDate(s.date)}{s.description ? ` · ${s.description}` : ''}
							</p>
						</button>
						<span
							class="font-semibold tabular-nums {s.direction === 'deposit'
								? 'text-emerald-700 dark:text-emerald-400'
								: ''}"
						>
							{s.direction === 'deposit' ? '+' : '−'}{formatCents(s.amountCents)}
						</span>
						<ConfirmAction
							action="?/delete"
							fields={{ id: s.id }}
							title={t.common.delete}
							message={t.savings.deleteConfirm}
							size="xs"
							variant="ghost"
							submit={enhanceWithToast()}
						>
							{t.common.delete}
						</ConfirmAction>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>

<FormSheet
	open={form !== null}
	onOpenChange={(o) => {
		if (!o) form = null;
	}}
	title={form?.id ? t.savings.editTransfer : t.savings.newTransfer}
>
	{#if form}
		<form
			id="savings-form"
			method="POST"
			action="?/save"
			class="space-y-5"
			use:enhance={enhanceWithToast({ busy: (v) => (busy = v), onSuccess: () => (form = null) })}
		>
			{#if form.id}<input type="hidden" name="id" value={form.id} />{/if}
			<fieldset>
				<legend class="mb-1.5 text-sm font-medium">{t.savings.direction}</legend>
				<div class="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
					{#each [['deposit', t.savings.deposit], ['withdrawal', t.savings.withdrawal]] as [value, label] (value)}
						<label
							class="cursor-pointer rounded-md px-3 py-1.5 text-center text-sm font-medium has-checked:bg-background has-checked:shadow-sm"
						>
							<input
								type="radio"
								name="direction"
								{value}
								bind:group={form.direction}
								class="sr-only"
							/>
							{label}
						</label>
					{/each}
				</div>
			</fieldset>
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1.5">
					<Label for="s-amount">{t.savings.amount}</Label>
					<AmountInput
						id="s-amount"
						name="amount"
						bind:value={form.amount}
						required
						class="h-11 text-lg font-semibold"
					/>
				</div>
				<div class="space-y-1.5">
					<Label for="s-date">{t.savings.date}</Label>
					<Input
						id="s-date"
						name="date"
						type="date"
						max={today}
						bind:value={form.date}
						required
						class="h-11"
					/>
				</div>
			</div>
			<p class="text-sm text-muted-foreground tabular-nums">
				{t.savings.available.replace('{amount}', formatCents(data.available))}
			</p>
			<div class="space-y-1.5">
				<Label for="s-description">{t.savings.description}</Label>
				<Textarea
					id="s-description"
					name="description"
					bind:value={form.description}
					rows={2}
					maxlength={1000}
					placeholder={t.savings.descriptionPlaceholder}
				/>
			</div>
		</form>
	{/if}
	{#snippet footer()}
		<Button type="submit" form="savings-form" class="h-11 w-full text-base" disabled={busy}
			>{t.common.save}</Button
		>
	{/snippet}
</FormSheet>
