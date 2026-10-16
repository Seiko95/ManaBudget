<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { Snippet } from 'svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button, type ButtonSize, type ButtonVariant } from '$lib/components/ui/button';
	import { t } from '$lib/i18n/fr';

	/** A button that asks for confirmation, then posts a form action. */
	let {
		action,
		fields = {},
		title,
		message,
		confirmLabel = t.common.delete,
		variant = 'destructive',
		size = 'sm',
		class: className = '',
		onDone,
		submit,
		children
	}: {
		action: string;
		fields?: Record<string, string | number>;
		title: string;
		message: string;
		confirmLabel?: string;
		variant?: ButtonVariant;
		size?: ButtonSize;
		class?: string;
		onDone?: () => void;
		submit?: SubmitFunction;
		children: Snippet;
	} = $props();

	let open = $state(false);
	let busy = $state(false);
	const formId = `confirm-${Math.random().toString(36).slice(2)}`;
</script>

<form
	id={formId}
	method="POST"
	{action}
	class="hidden"
	use:enhance={(input) => {
		busy = true;
		const custom = submit?.(input);
		return async (opts) => {
			if (typeof custom === 'function') await custom(opts);
			else await opts.update();
			busy = false;
			open = false;
			onDone?.();
		};
	}}
>
	{#each Object.entries(fields) as [name, value] (name)}
		<input type="hidden" {name} {value} />
	{/each}
</form>

<Button type="button" {variant} {size} class={className} onclick={() => (open = true)}>
	{@render children()}
</Button>

<Dialog.Root bind:open>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{title}</Dialog.Title>
			<Dialog.Description>{message}</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)}>{t.common.cancel}</Button>
			<Button type="submit" form={formId} variant="destructive" disabled={busy}>
				{confirmLabel}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
