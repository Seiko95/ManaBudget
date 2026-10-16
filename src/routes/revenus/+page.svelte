<script lang="ts">
	import { enhance } from '$app/forms';
	import Plus from '@lucide/svelte/icons/plus';
	import Repeat from '@lucide/svelte/icons/repeat';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import PeriodSwitcher from '$lib/components/PeriodSwitcher.svelte';
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

	type Form = { id?: number; amount: string; date: string; source: string; description: string };
	let form = $state<Form | null>(null);
	let busy = $state(false);
	const total = $derived(data.incomes.reduce((s, i) => s + i.amountCents, 0));
</script>

<svelte:head><title>{t.incomes.title} · {t.app.name}</title></svelte:head>

<PageHeader title={t.incomes.title} subtitle={t.incomes.subtitle}>
	{#snippet actions()}
		<Button onclick={() => (form = { amount: '', date: todayISO(), source: '', description: '' })}>
			<Plus />{t.incomes.newIncome}
		</Button>
	{/snippet}
</PageHeader>

<div class="flex flex-wrap items-center justify-between gap-3 px-4 pb-4 lg:px-8">
	<PeriodSwitcher period={data.period} isCurrent={data.period.isCurrent} />
	<p class="font-semibold tabular-nums" data-testid="income-total">
		{t.incomes.total.replace('{amount}', formatCents(total))}
	</p>
</div>

<div class="px-4 pb-8 lg:px-8">
	{#if data.incomes.length === 0}
		<p class="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
			{t.incomes.empty}
		</p>
	{:else}
		<ul class="divide-y rounded-xl border bg-card">
			{#each data.incomes as i (i.id)}
				<li class="flex items-center gap-3 px-4 py-3" data-testid="income-row">
					<button
						type="button"
						class="min-w-0 flex-1 text-left"
						onclick={() =>
							(form = {
								id: i.id,
								amount: centsToInput(i.amountCents),
								date: i.date,
								source: i.source,
								description: i.description
							})}
					>
						<p class="flex items-center gap-1.5 font-medium">
							{i.source || t.incomes.noSource}
							{#if i.recurringRuleId}<Repeat
									class="size-3.5 text-muted-foreground"
									aria-label={t.nav.recurring}
								/>{/if}
						</p>
						<p class="truncate text-sm text-muted-foreground">
							{formatShortDate(i.date)}{i.description ? ` · ${i.description}` : ''}
						</p>
					</button>
					<span class="font-semibold text-emerald-700 tabular-nums dark:text-emerald-400"
						>+{formatCents(i.amountCents)}</span
					>
					<ConfirmAction
						action="?/delete"
						fields={{ id: i.id }}
						title={t.common.delete}
						message={t.incomes.deleteConfirm}
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
</div>

<datalist id="income-sources">
	{#each data.sources as s (s)}<option value={s}></option>{/each}
</datalist>

<FormSheet
	open={form !== null}
	onOpenChange={(o) => {
		if (!o) form = null;
	}}
	title={form?.id ? t.incomes.editIncome : t.incomes.newIncome}
>
	{#if form}
		<form
			id="income-form"
			method="POST"
			action="?/save"
			class="space-y-5"
			use:enhance={enhanceWithToast({ busy: (v) => (busy = v), onSuccess: () => (form = null) })}
		>
			{#if form.id}<input type="hidden" name="id" value={form.id} />{/if}
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1.5">
					<Label for="i-amount">{t.incomes.amount}</Label>
					<AmountInput
						id="i-amount"
						name="amount"
						bind:value={form.amount}
						required
						class="h-11 text-lg font-semibold"
					/>
				</div>
				<div class="space-y-1.5">
					<Label for="i-date">{t.incomes.date}</Label>
					<Input id="i-date" name="date" type="date" bind:value={form.date} required class="h-11" />
				</div>
			</div>
			<div class="space-y-1.5">
				<Label for="i-source">{t.incomes.source}</Label>
				<Input
					id="i-source"
					name="source"
					list="income-sources"
					bind:value={form.source}
					maxlength={100}
					placeholder={t.incomes.sourcePlaceholder}
					autocomplete="off"
				/>
			</div>
			<div class="space-y-1.5">
				<Label for="i-description">{t.incomes.description}</Label>
				<Textarea
					id="i-description"
					name="description"
					bind:value={form.description}
					rows={2}
					maxlength={1000}
				/>
			</div>
		</form>
	{/if}
	{#snippet footer()}
		<Button type="submit" form="income-form" class="h-11 w-full text-base" disabled={busy}
			>{t.common.save}</Button
		>
	{/snippet}
</FormSheet>
