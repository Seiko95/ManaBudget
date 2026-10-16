<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import X from '@lucide/svelte/icons/x';
	import { t } from '$lib/i18n/fr';

	let {
		photos,
		index = $bindable<number | null>(null)
	}: { photos: { id: number }[]; index?: number | null } = $props();

	const open = $derived(index !== null);
	const current = $derived(index !== null ? photos[index] : null);
	let touchX = 0;

	function step(d: number) {
		if (index === null || photos.length < 2) return;
		index = (index + d + photos.length) % photos.length;
	}
</script>

<DialogPrimitive.Root
	{open}
	onOpenChange={(o) => {
		if (!o) index = null;
	}}
>
	<DialogPrimitive.Portal>
		<DialogPrimitive.Overlay class="fixed inset-0 z-50 bg-black/90" />
		<DialogPrimitive.Content
			class="fixed inset-0 z-50 flex items-center justify-center outline-none"
			onkeydown={(e) => {
				if (e.key === 'ArrowLeft') step(-1);
				if (e.key === 'ArrowRight') step(1);
			}}
			ontouchstart={(e) => (touchX = e.touches[0].clientX)}
			ontouchend={(e) => {
				const dx = e.changedTouches[0].clientX - touchX;
				if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
			}}
		>
			<DialogPrimitive.Title class="sr-only">
				{t.expenses.photo.replace('{n}', String((index ?? 0) + 1))}
			</DialogPrimitive.Title>
			{#if current}
				<img
					src="/photos/{current.id}"
					alt={t.expenses.photo.replace('{n}', String((index ?? 0) + 1))}
					class="max-h-full max-w-full object-contain"
				/>
			{/if}
			<DialogPrimitive.Close
				class="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 inline-flex size-10 items-center justify-center rounded-full bg-black/50 text-white"
				aria-label={t.common.close}
			>
				<X class="size-5" />
			</DialogPrimitive.Close>
			{#if photos.length > 1}
				<button
					type="button"
					class="absolute left-2 inline-flex size-10 items-center justify-center rounded-full bg-black/50 text-white"
					aria-label={t.expenses.prevPhoto}
					onclick={() => step(-1)}><ChevronLeft class="size-6" /></button
				>
				<button
					type="button"
					class="absolute right-2 inline-flex size-10 items-center justify-center rounded-full bg-black/50 text-white"
					aria-label={t.expenses.nextPhoto}
					onclick={() => step(1)}><ChevronRight class="size-6" /></button
				>
				<p class="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] text-sm text-white/80">
					{(index ?? 0) + 1} / {photos.length}
				</p>
			{/if}
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
