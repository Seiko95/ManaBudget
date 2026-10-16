/** Lower-case, accent-free text for client-side matching. */
export function normalize(s: string): string {
	return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
