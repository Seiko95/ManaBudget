<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import FormSheet from './FormSheet.svelte';
	import ExpenseForm from './ExpenseForm.svelte';
	import { Button } from '$lib/components/ui/button';
	import { ui } from '$lib/stores/ui.svelte';
	import type { BudgetOption, PlaceOption, TagOption } from '$lib/types';
	import { t } from '$lib/i18n/fr';

	type FormData = { budgets: BudgetOption[]; places: PlaceOption[]; tags: TagOption[] };

	let data = $state<FormData | null>(null);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let initial = $state<any>(null);
	let loadError = $state(false);
	let saving = $state(false);
	let generation = 0;

	async function load(editId: number | null) {
		const gen = ++generation;
		data = null;
		initial = null;
		loadError = false;
		try {
			const [form, expense] = await Promise.all([
				fetch('/api/expense-form').then((r) => (r.ok ? r.json() : Promise.reject())),
				editId
					? fetch(`/api/expenses/${editId}`).then((r) => (r.ok ? r.json() : Promise.reject()))
					: null
			]);
			if (gen !== generation) return;
			initial = expense?.expense ?? null;
			data = form;
		} catch {
			if (gen === generation) loadError = true;
		}
	}

	$effect(() => {
		if (ui.expenseSheetOpen) load(ui.editExpenseId);
	});
</script>

<FormSheet
	bind:open={ui.expenseSheetOpen}
	title={ui.editExpenseId ? t.expenses.editExpense : t.expenses.newExpense}
>
	{#if loadError}
		<p class="text-sm text-destructive">{t.common.error}</p>
	{:else if !data}
		<p class="text-sm text-muted-foreground">{t.common.loading}</p>
	{:else}
		<ExpenseForm
			formId="expense-form"
			budgets={data.budgets}
			places={data.places}
			tags={data.tags}
			{initial}
			onSaving={(v) => (saving = v)}
			onDone={() => {
				ui.expenseSheetOpen = false;
				invalidateAll();
			}}
		/>
	{/if}
	{#snippet footer()}
		<Button
			type="submit"
			form="expense-form"
			class="h-11 w-full text-base"
			disabled={saving || !data}
		>
			{t.common.save}
		</Button>
	{/snippet}
</FormSheet>
