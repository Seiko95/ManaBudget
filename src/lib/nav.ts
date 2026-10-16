import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
import Receipt from '@lucide/svelte/icons/receipt';
import Wallet from '@lucide/svelte/icons/wallet';
import PiggyBank from '@lucide/svelte/icons/piggy-bank';
import MapPin from '@lucide/svelte/icons/map-pin';
import Repeat from '@lucide/svelte/icons/repeat';
import ChartBar from '@lucide/svelte/icons/chart-bar';
import Settings from '@lucide/svelte/icons/settings';
import Shield from '@lucide/svelte/icons/shield';
import type { Component } from 'svelte';
import { t } from './i18n/fr';

export type NavItem = {
	href: string;
	label: string;
	icon: Component;
	adminOnly?: boolean;
	/** Shown in the phone bottom bar (the rest go in the "Plus" sheet). */
	primary?: boolean;
};

export const NAV: NavItem[] = [
	{ href: '/', label: t.nav.dashboard, icon: LayoutDashboard, primary: true },
	{ href: '/depenses', label: t.nav.expenses, icon: Receipt, primary: true },
	{ href: '/revenus', label: t.nav.incomes, icon: Wallet },
	{ href: '/budgets', label: t.nav.budgets, icon: PiggyBank },
	{ href: '/lieux', label: t.nav.places, icon: MapPin },
	{ href: '/recurrents', label: t.nav.recurring, icon: Repeat },
	{ href: '/statistiques', label: t.nav.stats, icon: ChartBar, primary: true },
	{ href: '/reglages', label: t.nav.settings, icon: Settings },
	{ href: '/admin', label: t.nav.admin, icon: Shield, adminOnly: true }
];

export function isActive(href: string, pathname: string): boolean {
	return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');
}
