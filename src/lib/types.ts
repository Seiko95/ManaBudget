/** Shapes sent to the client. */
export type CategoryOption = { id: number; name: string; icon: string; budgetId: number };
export type BudgetOption = {
	id: number;
	name: string;
	icon: string;
	color: string;
	categories: CategoryOption[];
};
export type PlaceOption = {
	id: number;
	name: string;
	address: string;
	lat: number | null;
	lng: number | null;
	defaultCategoryId: number | null;
	archived?: boolean;
};
export type TagOption = { id: number; name: string; color: string };
