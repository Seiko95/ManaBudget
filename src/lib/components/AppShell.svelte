<script lang="ts">
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';
	import Plus from '@lucide/svelte/icons/plus';
	import Menu from '@lucide/svelte/icons/menu';
	import LogOut from '@lucide/svelte/icons/log-out';
	import { NAV, isActive } from '$lib/nav';
	import { t } from '$lib/i18n/fr';
	import { ui, openNewExpense } from '$lib/stores/ui.svelte';
	import FormSheet from './FormSheet.svelte';

	let {
		user,
		alertCount = 0,
		children
	}: {
		user: { displayName: string; isAdmin: boolean };
		alertCount?: number;
		children: Snippet;
	} = $props();

	const items = $derived(NAV.filter((i) => !i.adminOnly || user.isAdmin));
	const primary = $derived(items.filter((i) => i.primary));
	const secondary = $derived(items.filter((i) => !i.primary));
	const pathname = $derived(page.url.pathname);
	const moreActive = $derived(secondary.some((i) => isActive(i.href, pathname)));
</script>

{#snippet badge()}
	{#if alertCount > 0}
		<span
			class="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-semibold text-white"
			aria-label="{alertCount} alertes"
			data-testid="alert-badge">{alertCount}</span
		>
	{/if}
{/snippet}

<div class="min-h-dvh lg:flex">
	<!-- Desktop sidebar -->
	<aside
		class="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground lg:flex"
	>
		<div class="px-5 py-5">
			<a href="/" class="text-xl font-bold tracking-tight">{t.app.name}</a>
			<p class="truncate text-sm text-muted-foreground">{user.displayName}</p>
		</div>
		<div class="px-3 pb-3">
			<button
				type="button"
				onclick={openNewExpense}
				class="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
			>
				<Plus class="size-4" />
				{t.nav.newExpense}
			</button>
		</div>
		<nav aria-label={t.nav.mainNav} class="flex-1 space-y-0.5 overflow-y-auto px-3">
			{#each items as item (item.href)}
				{@const Icon = item.icon}
				<a
					href={item.href}
					aria-current={isActive(item.href, pathname) ? 'page' : undefined}
					class="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-sidebar-accent aria-[current=page]:bg-sidebar-accent aria-[current=page]:text-sidebar-accent-foreground"
				>
					<Icon class="size-4" />
					{item.label}
					{#if item.href === '/'}{@render badge()}{/if}
				</a>
			{/each}
		</nav>
		<form method="POST" action="/logout" class="border-t p-3">
			<button
				class="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent"
			>
				<LogOut class="size-4" />
				{t.auth.logout}
			</button>
		</form>
	</aside>

	<main class="min-w-0 flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0">
		{@render children()}
	</main>
</div>

<!-- Phone bottom bar -->
<nav
	aria-label={t.nav.mainNav}
	class="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
>
	<div class="mx-auto grid max-w-lg grid-cols-5 items-end">
		{#each primary.slice(0, 2) as item (item.href)}
			{@const Icon = item.icon}
			<a
				href={item.href}
				aria-current={isActive(item.href, pathname) ? 'page' : undefined}
				class="relative flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground aria-[current=page]:text-foreground"
			>
				<Icon class="size-5" />
				{item.href === '/' ? t.nav.dashboardShort : item.label}
				{#if item.href === '/' && alertCount > 0}
					<span
						class="absolute top-1 right-[calc(50%-1.1rem)] size-2.5 rounded-full bg-destructive"
						aria-label="{alertCount} alertes"
					></span>
				{/if}
			</a>
		{/each}
		<div class="flex justify-center">
			<button
				type="button"
				onclick={openNewExpense}
				aria-label={t.nav.newExpense}
				data-testid="fab-new-expense"
				class="-mt-5 mb-1 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background"
			>
				<Plus class="size-7" />
			</button>
		</div>
		{#each primary.slice(2) as item (item.href)}
			{@const Icon = item.icon}
			<a
				href={item.href}
				aria-current={isActive(item.href, pathname) ? 'page' : undefined}
				class="flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground aria-[current=page]:text-foreground"
			>
				<Icon class="size-5" />
				{item.href === '/statistiques' ? t.nav.statsShort : item.label}
			</a>
		{/each}
		<button
			type="button"
			onclick={() => (ui.moreOpen = true)}
			aria-current={moreActive ? 'page' : undefined}
			class="flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground aria-[current=page]:text-foreground"
		>
			<Menu class="size-5" />
			{t.nav.more}
		</button>
	</div>
</nav>

<FormSheet bind:open={ui.moreOpen} title={t.nav.more}>
	<nav class="space-y-1">
		{#each secondary as item (item.href)}
			{@const Icon = item.icon}
			<a
				href={item.href}
				onclick={() => (ui.moreOpen = false)}
				aria-current={isActive(item.href, pathname) ? 'page' : undefined}
				class="flex items-center gap-3 rounded-lg px-3 py-3 text-base hover:bg-accent aria-[current=page]:bg-accent"
			>
				<Icon class="size-5" />
				{item.label}
			</a>
		{/each}
		<form method="POST" action="/logout">
			<button
				class="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-base text-muted-foreground hover:bg-accent"
			>
				<LogOut class="size-5" />
				{t.auth.logout}
			</button>
		</form>
	</nav>
</FormSheet>
