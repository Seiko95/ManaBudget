/**
 * Categorical palette for budgets (validated for colour-blind separation).
 * The DB stores the light value; charts swap to the dark step in dark mode.
 */
export const BUDGET_PALETTE: { light: string; dark: string; name: string }[] = [
	{ name: 'Bleu', light: '#2a78d6', dark: '#3987e5' },
	{ name: 'Orange', light: '#eb6834', dark: '#d95926' },
	{ name: 'Turquoise', light: '#1baf7a', dark: '#199e70' },
	{ name: 'Jaune', light: '#eda100', dark: '#c98500' },
	{ name: 'Magenta', light: '#e87ba4', dark: '#d55181' },
	{ name: 'Vert', light: '#008300', dark: '#008300' },
	{ name: 'Violet', light: '#6250d6', dark: '#9085e9' },
	{ name: 'Rouge', light: '#e34948', dark: '#e66767' },
	{ name: 'Gris', light: '#64748b', dark: '#94a3b8' }
];

const darkByLight = new Map(BUDGET_PALETTE.map((c) => [c.light.toLowerCase(), c.dark]));

/** The colour to draw a budget with in the current theme. */
export function budgetColor(color: string, dark: boolean): string {
	if (!dark) return color;
	return darkByLight.get(color.toLowerCase()) ?? color;
}

/** Status colours (fixed, never themed); always paired with a label. */
export const STATUS_COLORS = {
	ok: '#0ca30c',
	warning: '#fab219',
	over: '#d03b3b'
} as const;

export function isHexColor(s: string): boolean {
	return /^#[0-9a-fA-F]{6}$/.test(s);
}
