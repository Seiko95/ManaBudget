<script lang="ts">
	import { enhance } from '$app/forms';
	import Plus from '@lucide/svelte/icons/plus';
	import Pencil from '@lucide/svelte/icons/pencil';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import FormSheet from '$lib/components/FormSheet.svelte';
	import AmountInput from '$lib/components/AmountInput.svelte';
	import NativeSelect from '$lib/components/NativeSelect.svelte';
	import CategorySelect from '$lib/components/CategorySelect.svelte';
	import ConfirmAction from '$lib/components/ConfirmAction.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
	import { Badge } from '$lib/components/ui/badge';
	import { enhanceWithToast } from '$lib/forms';
	import { centsToInput, formatCents, formatNumericDate } from '$lib/format';
	import { todayISO } from '$lib/periods';
	import { t } from '$lib/i18n/fr';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Form = {
		id?: number;
		kind: 'expense' | 'income';
		amount: string;
		categoryId: number | null;
		placeId: string;
		source: string;
		description: string;
		frequency: 'monthly' | 'weekly' | 'yearly';
		dayOfMonth: number;
		startDate: string;
		endDate: string;
		active: boolean;
	};
	let form = $state<Form | null>(null);
	let busy = $state(false);

	const groups = $derived([
		{
			kind: 'expense' as const,
			title: t.recurring.expenses,
			rules: data.rules.filter((r) => r.kind === 'expense')
		},
		{
			kind: 'income' as const,
			title: t.recurring.incomes,
			rules: data.rules.filter((r) => r.kind === 'income')
		}
	]);

	function newRule(kind: 'expense' | 'income') {
		const today = todayISO();
		form = {
			kind,
			amount: '',
			categoryId: null,
			placeId: '',
			source: '',
			description: '',
			frequency: 'monthly',
			dayOfMonth: Number(today.slice(8, 10)),
			startDate: today,
			endDate: '',
			active: true
		};
	}

	function schedule(r: (typeof data.rules)[number]) {
		if (r.frequency === 'weekly') return t.recurring.everyWeek;
		if (r.frequency === 'yearly') return t.recurring.everyYear;
		return t.recurring.everyMonth.replace('{day}', String(r.dayOfMonth));
	}
	const ended = (r: (typeof data.rules)[number]) => !!r.endDate && r.nextDueDate > r.endDate;
</script>

<svelte:head><title>{t.recurring.title} · {t.app.name}</title></svelte:head>

<PageHeader title={t.recurring.title} subtitle={t.recurring.subtitle}>
	{#snippet actions()}
		<Button onclick={() => newRule('expense')}><Plus />{t.recurring.newRule}</Button>
	{/snippet}
</PageHeader>

<div class="grid gap-6 px-4 pb-8 lg:grid-cols-2 lg:px-8">
	{#each groups as g (g.kind)}
		<section>
			<div class="mb-2 flex items-center justify-between">
				<h2 class="font-semibold">{g.title}</h2>
				<Button variant="ghost" size="sm" onclick={() => newRule(g.kind)}
					><Plus />{t.common.add}</Button
				>
			</div>
			{#if g.rules.length === 0}
				<p class="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
					{t.recurring.empty}
				</p>
			{:else}
				<ul class="divide-y rounded-xl border bg-card">
					{#each g.rules as r (r.id)}
						{@const cat = r.categoryId ? data.categoryNames[r.categoryId] : null}
						<li
							class="flex items-center gap-3 px-4 py-3 {r.active ? '' : 'opacity-60'}"
							data-testid="rule-row"
						>
							{#if cat}
								<span class="size-3 shrink-0 rounded-full" style="background-color: {cat.color}"
								></span>
							{/if}
							<div class="min-w-0 flex-1">
								<p class="truncate font-medium">
									{r.description || cat?.name || r.source || t.recurring.title}
									{#if !r.active}<Badge variant="secondary">{t.recurring.paused}</Badge>{/if}
									{#if ended(r)}<Badge variant="secondary">{t.recurring.ended}</Badge>{/if}
								</p>
								<p class="truncate text-sm text-muted-foreground">
									{schedule(r)}{cat
										? ` · ${cat.name}`
										: r.source && r.description
											? ` · ${r.source}`
											: ''}
								</p>
								{#if r.active && !ended(r)}
									<p class="text-xs text-muted-foreground">
										{t.recurring.next.replace('{date}', formatNumericDate(r.nextDueDate))}
									</p>
								{/if}
							</div>
							<span class="font-semibold tabular-nums">{formatCents(r.amountCents)}</span>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label={t.recurring.editRule}
								onclick={() =>
									(form = {
										id: r.id,
										kind: r.kind,
										amount: centsToInput(r.amountCents),
										categoryId: r.categoryId,
										placeId: r.placeId ? String(r.placeId) : '',
										source: r.source,
										description: r.description,
										frequency: r.frequency,
										dayOfMonth: r.dayOfMonth,
										startDate: r.startDate,
										endDate: r.endDate ?? '',
										active: r.active
									})}
							>
								<Pencil />
							</Button>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/each}
</div>

<datalist id="rule-sources">
	{#each data.sources as s (s)}<option value={s}></option>{/each}
</datalist>

<FormSheet
	open={form !== null}
	onOpenChange={(o) => {
		if (!o) form = null;
	}}
	title={form?.id ? t.recurring.editRule : t.recurring.newRule}
>
	{#if form}
		<form
			id="rule-form"
			method="POST"
			action="?/save"
			class="space-y-5"
			use:enhance={enhanceWithToast({ busy: (v) => (busy = v), onSuccess: () => (form = null) })}
		>
			{#if form.id}<input type="hidden" name="id" value={form.id} />{/if}
			<fieldset>
				<legend class="mb-1.5 text-sm font-medium">{t.recurring.kind}</legend>
				<div class="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
					{#each [['expense', t.recurring.kindExpense], ['income', t.recurring.kindIncome]] as [value, label] (value)}
						<label
							class="cursor-pointer rounded-md px-3 py-1.5 text-center text-sm font-medium has-checked:bg-background has-checked:shadow-sm"
						>
							<input type="radio" name="kind" {value} bind:group={form.kind} class="sr-only" />
							{label}
						</label>
					{/each}
				</div>
			</fieldset>
			<div class="space-y-1.5">
				<Label for="r-amount">{t.expenses.amount}</Label>
				<AmountInput id="r-amount" name="amount" bind:value={form.amount} required />
			</div>
			{#if form.kind === 'expense'}
				<div class="space-y-1.5">
					<Label for="r-category">{t.expenses.category}</Label>
					<CategorySelect
						id="r-category"
						name="categoryId"
						budgets={data.budgets}
						bind:value={form.categoryId}
						allowNone={false}
					/>
				</div>
				<div class="space-y-1.5">
					<Label for="r-place">{t.expenses.place}</Label>
					<NativeSelect id="r-place" name="placeId" bind:value={form.placeId}>
						<option value="">{t.expenses.noPlace}</option>
						{#each data.places.filter((p) => !p.archived || String(p.id) === form?.placeId) as p (p.id)}
							<option value={String(p.id)}>{p.name}</option>
						{/each}
					</NativeSelect>
				</div>
			{:else}
				<div class="space-y-1.5">
					<Label for="r-source">{t.incomes.source}</Label>
					<Input
						id="r-source"
						name="source"
						list="rule-sources"
						bind:value={form.source}
						maxlength={100}
						autocomplete="off"
					/>
				</div>
			{/if}
			<div class="space-y-1.5">
				<Label for="r-description">{t.expenses.description}</Label>
				<Input
					id="r-description"
					name="description"
					bind:value={form.description}
					maxlength={1000}
				/>
			</div>
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1.5">
					<Label for="r-frequency">{t.recurring.frequency}</Label>
					<NativeSelect id="r-frequency" name="frequency" bind:value={form.frequency}>
						<option value="monthly">{t.recurring.monthly}</option>
						<option value="weekly">{t.recurring.weekly}</option>
						<option value="yearly">{t.recurring.yearly}</option>
					</NativeSelect>
				</div>
				{#if form.frequency !== 'weekly'}
					<div class="space-y-1.5">
						<Label for="r-day">{t.recurring.dayOfMonth}</Label>
						<Input
							id="r-day"
							name="dayOfMonth"
							type="number"
							inputmode="numeric"
							min={1}
							max={31}
							bind:value={form.dayOfMonth}
						/>
					</div>
				{/if}
			</div>
			{#if form.frequency !== 'weekly'}
				<p class="-mt-3 text-xs text-muted-foreground">{t.recurring.dayHelp}</p>
			{/if}
			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1.5">
					<Label for="r-start">{t.recurring.startDate}</Label>
					<Input id="r-start" name="startDate" type="date" bind:value={form.startDate} required />
				</div>
				<div class="space-y-1.5">
					<Label for="r-end">{t.recurring.endDate}</Label>
					<Input id="r-end" name="endDate" type="date" bind:value={form.endDate} />
				</div>
			</div>
			<label class="flex items-center gap-2 text-sm">
				<Switch bind:checked={form.active} name="active" />
				{t.recurring.active}
			</label>
		</form>
		{#if form.id}
			<div class="mt-6 border-t pt-4">
				<ConfirmAction
					action="?/delete"
					fields={{ id: form.id }}
					title={t.common.delete}
					message={t.recurring.deleteConfirm}
					submit={enhanceWithToast({ onSuccess: () => (form = null) })}
				>
					{t.common.delete}
				</ConfirmAction>
			</div>
		{/if}
	{/if}
	{#snippet footer()}
		<Button type="submit" form="rule-form" class="h-11 w-full text-base" disabled={busy}
			>{t.common.save}</Button
		>
	{/snippet}
</FormSheet>
