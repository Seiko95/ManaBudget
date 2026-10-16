<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import XIcon from '@lucide/svelte/icons/x';
	import type { Snippet } from 'svelte';
	import { t } from '$lib/i18n/fr';

	/**
	 * Form container: a full-screen sheet on phones, a side panel on desktop.
	 */
	let {
		open = $bindable(false),
		title,
		description,
		children,
		footer,
		onOpenChange
	}: {
		open?: boolean;
		title: string;
		description?: string;
		children: Snippet;
		footer?: Snippet;
		onOpenChange?: (open: boolean) => void;
	} = $props();
</script>

<DialogPrimitive.Root bind:open {onOpenChange}>
	<DialogPrimitive.Portal>
		<DialogPrimitive.Overlay
			class="fixed inset-0 z-50 bg-black/40 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
		/>
		<DialogPrimitive.Content
			class="fixed inset-0 z-50 flex flex-col bg-background outline-none lg:inset-y-0 lg:right-0 lg:left-auto lg:w-[30rem] lg:border-l lg:shadow-xl data-open:animate-in data-open:slide-in-from-bottom lg:data-open:slide-in-from-right data-closed:animate-out data-closed:slide-out-to-bottom lg:data-closed:slide-out-to-right"
		>
			<header
				class="flex items-center gap-2 border-b px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
			>
				<div class="min-w-0 flex-1">
					<DialogPrimitive.Title class="truncate text-lg font-semibold"
						>{title}</DialogPrimitive.Title
					>
					{#if description}
						<DialogPrimitive.Description class="text-sm text-muted-foreground">
							{description}
						</DialogPrimitive.Description>
					{/if}
				</div>
				<DialogPrimitive.Close
					class="inline-flex size-9 items-center justify-center rounded-md hover:bg-accent"
					aria-label={t.common.close}
				>
					<XIcon class="size-5" />
				</DialogPrimitive.Close>
			</header>
			<div class="flex-1 overflow-y-auto px-4 py-4">
				{@render children()}
			</div>
			{#if footer}
				<footer class="border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
					{@render footer()}
				</footer>
			{/if}
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
