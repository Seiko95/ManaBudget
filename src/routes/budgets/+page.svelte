<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import Plus from '@lucide/svelte/icons/plus';
	import Pencil from '@lucide/svelte/icons/pencil';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import Archive from '@lucide/svelte/icons/archive';
	import ArchiveRestore from '@lucide/svelte/icons/archive-restore';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import * as Dialog from '$lib/components/ui/dialog';
	import CategorySelect from '$lib/components/CategorySelect.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import PeriodSwitcher from '$lib/components/PeriodSwitcher.svelte';
	import FormSheet from '$lib/components/FormSheet.svelte';
	import ColorPicker from '$lib/components/ColorPicker.svelte';
	import AmountInput from '$lib/components/AmountInput.svelte';
	import NativeSelect from '$lib/components/NativeSelect.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import { Switch } from '$lib/components/ui/switch';
	import { enhanceWithToast } from '$lib/forms';
	import { centsToInput, formatCents, formatPercent } from '$lib/format';
	import { periodLabelText } from '$lib/periods';
	import { BUDGET_PALETTE } from '$lib/colors';
	import { goto } from '$app/navigation';
	import { t } from '$lib/i18n/fr';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type BudgetForm = {
		id?: number;
		name: string;
		icon: string;
		color: string;
		limit: string;
		alertThreshold: number;
	};
	type CategoryForm = { id?: number; name: string; icon: string; budgetId: number };

	let budgetForm = $state<BudgetForm | null>(null);
	let categoryForm = $state<CategoryForm | null>(null);
	let busy = $state(false);

	type Deleting = { kind: 'budget' | 'category'; id: number; name: string; budgetId: number };
	let deleting = $state<Deleting | null>(null);
	let deleteTarget = $state<number | null>(null);

	const deleteUsage = $derived(
		deleting
			? ((deleting.kind === 'budget'
					? data.usage.byBudget[deleting.id]
					: data.usage.byCategory[deleting.id]) ?? null)
			: null
	);
	// Where the expenses can go: active categories outside what is being deleted
	const deleteOptions = $derived(
		deleting
			? data.budgets
					.filter((b) => !b.archived && !(deleting!.kind === 'budget' && b.id === deleting!.id))
					.map((b) => ({
						...b,
						categories: b.categories.filter(
							(c) => !c.archived && !(deleting!.kind === 'category' && c.id === deleting!.id)
						)
					}))
					.filter((b) => b.categories.length)
			: []
	);

	function askDelete(d: Deleting) {
		deleting = d;
		const own = data.budgets.find((b) => b.id === d.budgetId);
		// Default to a sibling category when deleting a category, else the first available one
		const options = deleteOptions;
		const sibling =
			d.kind === 'category'
				? own?.categories.find((c) => c.id !== d.id && !c.archived)?.id
				: undefined;
		deleteTarget = sibling ?? options[0]?.categories[0]?.id ?? null;
	}

	function deleteMessage(d: Deleting): string {
		const u = deleteUsage;
		if (!u)
			return d.kind === 'budget' ? t.budgets.deleteBudgetUnused : t.budgets.deleteCategoryUnused;
		return (d.kind === 'budget' ? t.budgets.deleteBudgetUsed : t.budgets.deleteUsed)
			.replace('{splits}', String(u.splits))
			.replace('{rules}', String(u.rules));
	}

	function newBudget() {
		const used = new Set(data.budgets.map((b) => b.color));
		const color = BUDGET_PALETTE.find((c) => !used.has(c.light))?.light ?? BUDGET_PALETTE[0].light;
		budgetForm = { name: '', icon: '', color, limit: '', alertThreshold: 80 };
	}

	function toggleArchived(on: boolean) {
		const u = new URL(page.url);
		if (on) u.searchParams.set('archives', '1');
		else u.searchParams.delete('archives');
		goto(u.pathname + u.search, { noScroll: true, keepFocus: true });
	}
</script>

<svelte:head><title>{t.budgets.title} · {t.app.name}</title></svelte:head>

<PageHeader title={t.budgets.title} subtitle={t.budgets.subtitle}>
	{#snippet actions()}
		<Button onclick={newBudget}><Plus />{t.budgets.newBudget}</Button>
	{/snippet}
</PageHeader>

<div class="flex flex-wrap items-center justify-between gap-3 px-4 pb-4 lg:px-8">
	<PeriodSwitcher period={data.period} isCurrent={data.period.isCurrent} />
	<label class="flex items-center gap-2 text-sm">
		<Switch checked={data.showArchived} onCheckedChange={toggleArchived} />
		{t.common.showArchived}
	</label>
</div>

<div class="grid gap-4 px-4 pb-8 lg:grid-cols-2 lg:px-8">
	{#each data.budgets as b, i (b.id)}
		<section
			class="rounded-xl border bg-card {b.archived ? 'opacity-60' : ''}"
			data-testid="budget-card"
		>
			<header class="flex items-start gap-3 border-b p-4">
				<span
					class="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-lg"
					style="background-color: color-mix(in oklab, {b.color} 22%, transparent); box-shadow: inset 0 0 0 2px {b.color}"
					aria-hidden="true">{b.icon}</span
				>
				<div class="min-w-0 flex-1">
					<h2 class="font-semibold">
						{b.name}
						{#if b.archived}<Badge variant="secondary">{t.common.archived}</Badge>{/if}
					</h2>
					<p class="text-sm text-muted-foreground">
						{b.limitCents > 0
							? t.budgets.limitValue.replace('{amount}', formatCents(b.limitCents))
							: t.budgets.noLimit}
						· {t.budgets.alertValue.replace('{pct}', formatPercent(b.alertThreshold))}
					</p>
				</div>
				<div class="flex shrink-0 items-center">
					{#if !b.archived}
						<form method="POST" action="?/moveBudget" use:enhance>
							<input type="hidden" name="id" value={b.id} />
							<input type="hidden" name="dir" value="up" />
							<Button
								variant="ghost"
								size="icon-sm"
								type="submit"
								disabled={i === 0}
								aria-label={t.budgets.moveUp}
							>
								<ArrowUp />
							</Button>
						</form>
						<form method="POST" action="?/moveBudget" use:enhance>
							<input type="hidden" name="id" value={b.id} />
							<input type="hidden" name="dir" value="down" />
							<Button
								variant="ghost"
								size="icon-sm"
								type="submit"
								disabled={i === data.budgets.length - 1}
								aria-label={t.budgets.moveDown}
							>
								<ArrowDown />
							</Button>
						</form>
					{/if}
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label={t.budgets.editBudget}
						onclick={() =>
							(budgetForm = {
								id: b.id,
								name: b.name,
								icon: b.icon,
								color: b.color,
								limit: b.limitCents ? centsToInput(b.limitCents) : '',
								alertThreshold: b.alertThreshold
							})}
					>
						<Pencil />
					</Button>
					<form method="POST" action="?/archiveBudget" use:enhance={enhanceWithToast()}>
						<input type="hidden" name="id" value={b.id} />
						<input type="hidden" name="archived" value={b.archived ? 'false' : 'true'} />
						<Button
							variant="ghost"
							size="icon-sm"
							type="submit"
							aria-label={b.archived ? t.common.unarchive : t.common.archive}
							title={b.archived ? t.common.unarchive : t.common.archive}
						>
							{#if b.archived}<ArchiveRestore />{:else}<Archive />{/if}
						</Button>
					</form>
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label={t.budgets.deleteBudget}
						title={t.budgets.deleteBudget}
						onclick={() => askDelete({ kind: 'budget', id: b.id, name: b.name, budgetId: b.id })}
					>
						<Trash2 />
					</Button>
				</div>
			</header>
			<ul class="divide-y">
				{#each b.categories as c, j (c.id)}
					<li class="flex items-center gap-2 px-4 py-2 {c.archived ? 'opacity-60' : ''}">
						<span class="w-6 text-center" aria-hidden="true">{c.icon}</span>
						<span class="min-w-0 flex-1 truncate text-sm">
							{c.name}
							{#if c.archived}<Badge variant="secondary">{t.common.archived}</Badge>{/if}
						</span>
						{#if !c.archived}
							<form method="POST" action="?/moveCategory" use:enhance>
								<input type="hidden" name="id" value={c.id} />
								<input type="hidden" name="dir" value="up" />
								<Button
									variant="ghost"
									size="icon-xs"
									type="submit"
									disabled={j === 0}
									aria-label={t.budgets.moveUp}
								>
									<ArrowUp />
								</Button>
							</form>
							<form method="POST" action="?/moveCategory" use:enhance>
								<input type="hidden" name="id" value={c.id} />
								<input type="hidden" name="dir" value="down" />
								<Button
									variant="ghost"
									size="icon-xs"
									type="submit"
									disabled={j === b.categories.length - 1}
									aria-label={t.budgets.moveDown}
								>
									<ArrowDown />
								</Button>
							</form>
						{/if}
						<Button
							variant="ghost"
							size="icon-xs"
							aria-label={t.budgets.editCategory}
							onclick={() =>
								(categoryForm = { id: c.id, name: c.name, icon: c.icon, budgetId: c.budgetId })}
						>
							<Pencil />
						</Button>
						<form method="POST" action="?/archiveCategory" use:enhance={enhanceWithToast()}>
							<input type="hidden" name="id" value={c.id} />
							<input type="hidden" name="archived" value={c.archived ? 'false' : 'true'} />
							<Button
								variant="ghost"
								size="icon-xs"
								type="submit"
								aria-label={c.archived ? t.common.unarchive : t.common.archive}
								title={c.archived ? t.common.unarchive : t.common.archive}
							>
								{#if c.archived}<ArchiveRestore />{:else}<Archive />{/if}
							</Button>
						</form>
						<Button
							variant="ghost"
							size="icon-xs"
							aria-label={t.budgets.deleteCategory}
							title={t.budgets.deleteCategory}
							onclick={() =>
								askDelete({ kind: 'category', id: c.id, name: c.name, budgetId: c.budgetId })}
						>
							<Trash2 />
						</Button>
					</li>
				{:else}
					<li class="px-4 py-3 text-sm text-muted-foreground">{t.budgets.empty}</li>
				{/each}
			</ul>
			{#if !b.archived}
				<div class="p-2">
					<Button
						variant="ghost"
						size="sm"
						onclick={() => (categoryForm = { name: '', icon: '', budgetId: b.id })}
					>
						<Plus />{t.budgets.newCategory}
					</Button>
				</div>
			{/if}
		</section>
	{/each}
</div>

<FormSheet
	open={budgetForm !== null}
	onOpenChange={(o) => {
		if (!o) budgetForm = null;
	}}
	title={budgetForm?.id ? t.budgets.editBudget : t.budgets.newBudget}
>
	{#if budgetForm}
		<form
			id="budget-form"
			method="POST"
			action="?/saveBudget"
			class="space-y-5"
			use:enhance={enhanceWithToast({
				busy: (v) => (busy = v),
				onSuccess: () => (budgetForm = null)
			})}
		>
			{#if budgetForm.id}<input type="hidden" name="id" value={budgetForm.id} />{/if}
			<input type="hidden" name="periode" value={data.period.label} />
			<div class="grid grid-cols-[1fr_6rem] gap-3">
				<div class="space-y-1.5">
					<Label for="b-name">{t.budgets.name}</Label>
					<Input id="b-name" name="name" required maxlength={60} bind:value={budgetForm.name} />
				</div>
				<div class="space-y-1.5">
					<Label for="b-icon">{t.budgets.icon}</Label>
					<Input
						id="b-icon"
						name="icon"
						maxlength={16}
						bind:value={budgetForm.icon}
						class="text-center"
					/>
				</div>
			</div>
			<ColorPicker label={t.budgets.color} bind:value={budgetForm.color} />
			<div class="space-y-1.5">
				<Label for="b-limit">{t.budgets.limit}</Label>
				<AmountInput id="b-limit" name="limit" bind:value={budgetForm.limit} />
				<p class="text-xs text-muted-foreground">
					{t.budgets.limitHelp}
					{t.budgets.limitFrom.replace('{period}', periodLabelText(data.period.label))}
				</p>
			</div>
			<div class="space-y-1.5">
				<Label for="b-alert">{t.budgets.alertThreshold}</Label>
				<Input
					id="b-alert"
					name="alertThreshold"
					type="number"
					inputmode="numeric"
					min={1}
					max={100}
					bind:value={budgetForm.alertThreshold}
				/>
				<p class="text-xs text-muted-foreground">{t.budgets.alertHelp}</p>
			</div>
		</form>
	{/if}
	{#snippet footer()}
		<Button type="submit" form="budget-form" class="w-full" disabled={busy}>{t.common.save}</Button>
	{/snippet}
</FormSheet>

<FormSheet
	open={categoryForm !== null}
	onOpenChange={(o) => {
		if (!o) categoryForm = null;
	}}
	title={categoryForm?.id ? t.budgets.editCategory : t.budgets.newCategory}
>
	{#if categoryForm}
		<form
			id="category-form"
			method="POST"
			action="?/saveCategory"
			class="space-y-5"
			use:enhance={enhanceWithToast({
				busy: (v) => (busy = v),
				onSuccess: () => (categoryForm = null)
			})}
		>
			{#if categoryForm.id}<input type="hidden" name="id" value={categoryForm.id} />{/if}
			<div class="grid grid-cols-[1fr_6rem] gap-3">
				<div class="space-y-1.5">
					<Label for="c-name">{t.budgets.name}</Label>
					<Input id="c-name" name="name" required maxlength={60} bind:value={categoryForm.name} />
				</div>
				<div class="space-y-1.5">
					<Label for="c-icon">{t.budgets.icon}</Label>
					<Input
						id="c-icon"
						name="icon"
						maxlength={16}
						bind:value={categoryForm.icon}
						class="text-center"
					/>
				</div>
			</div>
			<div class="space-y-1.5">
				<Label for="c-budget">{t.budgets.categoryBudget}</Label>
				<NativeSelect id="c-budget" name="budgetId" bind:value={categoryForm.budgetId}>
					{#each data.budgets.filter((b) => !b.archived) as b (b.id)}
						<option value={b.id}>{b.icon} {b.name}</option>
					{/each}
				</NativeSelect>
			</div>
		</form>
	{/if}
	{#snippet footer()}
		<Button type="submit" form="category-form" class="w-full" disabled={busy}
			>{t.common.save}</Button
		>
	{/snippet}
</FormSheet>

<Dialog.Root
	open={deleting !== null}
	onOpenChange={(o) => {
		if (!o) deleting = null;
	}}
>
	<Dialog.Content>
		{#if deleting}
			<Dialog.Header>
				<Dialog.Title>{t.budgets.deleteTitle.replace('{name}', deleting.name)}</Dialog.Title>
				<Dialog.Description>{deleteMessage(deleting)}</Dialog.Description>
			</Dialog.Header>
			<form
				id="delete-form"
				method="POST"
				action={deleting.kind === 'budget' ? '?/deleteBudget' : '?/deleteCategory'}
				use:enhance={enhanceWithToast({
					busy: (v) => (busy = v),
					onSuccess: () => (deleting = null)
				})}
			>
				<input type="hidden" name="id" value={deleting.id} />
				{#if deleteUsage}
					{#if deleteOptions.length}
						<div class="space-y-1.5">
							<Label for="delete-target">{t.budgets.moveTo}</Label>
							<CategorySelect
								id="delete-target"
								name="target"
								budgets={deleteOptions}
								allowNone={false}
								bind:value={deleteTarget}
							/>
						</div>
					{:else}
						<p class="text-sm text-destructive">{t.budgets.noReplacement}</p>
					{/if}
				{/if}
			</form>
			<Dialog.Footer>
				<Button variant="outline" onclick={() => (deleting = null)}>{t.common.cancel}</Button>
				<Button
					type="submit"
					form="delete-form"
					variant="destructive"
					disabled={busy || (!!deleteUsage && !deleteTarget)}
				>
					{t.common.delete}
				</Button>
			</Dialog.Footer>
		{/if}
	</Dialog.Content>
</Dialog.Root>
