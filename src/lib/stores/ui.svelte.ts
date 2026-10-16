/** Client-side UI state shared across the shell (e.g. the global expense sheet). */
export const ui = $state({
	expenseSheetOpen: false,
	moreOpen: false
});

export function openNewExpense() {
	ui.expenseSheetOpen = true;
}
