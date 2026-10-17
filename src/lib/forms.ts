import type { SubmitFunction } from '@sveltejs/kit';
import { toast } from 'svelte-sonner';
import { t } from './i18n/fr';

type Opts = {
	/** Called after a successful submission (before invalidation finishes). */
	onSuccess?: (data: Record<string, unknown> | undefined) => void;
	reset?: boolean;
	busy?: (v: boolean) => void;
};

/**
 * use:enhance handler that toasts `success` / `error` messages from the action result.
 */
export function enhanceWithToast(opts: Opts = {}): SubmitFunction {
	return () => {
		opts.busy?.(true);
		return async ({ result, update }) => {
			opts.busy?.(false);
			if (result.type === 'success') {
				const data = result.data as Record<string, unknown> | undefined;
				if (typeof data?.success === 'string') toast.success(data.success);
				if (Array.isArray(data?.alerts))
					for (const a of data.alerts as string[]) toast.warning(a, { duration: 8000 });
				// Reset before onSuccess: callers close their sheet there by nulling the state the
				// form's inputs are bound to, and a reset afterwards would write into that null
				await update({ reset: opts.reset ?? true });
				opts.onSuccess?.(data);
			} else if (result.type === 'failure') {
				const msg = (result.data as { error?: string } | undefined)?.error;
				toast.error(msg ?? t.common.error);
				await update({ reset: false });
			} else if (result.type === 'error') {
				toast.error(result.error?.message ?? t.common.error);
			} else {
				await update();
			}
		};
	};
}
