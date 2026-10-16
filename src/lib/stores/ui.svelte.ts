/** Client-side UI state shared across the shell (e.g. the global expense sheet). */
export const ui = $state({
	expenseSheetOpen: false,
	/** Expense being edited in the sheet; null = new expense. */
	editExpenseId: null as number | null,
	moreOpen: false
});

export function openNewExpense() {
	ui.editExpenseId = null;
	ui.expenseSheetOpen = true;
}

export function openEditExpense(id: number) {
	ui.editExpenseId = id;
	ui.expenseSheetOpen = true;
}
