import type { LatLng } from './geo';

/** The device position, shared app-wide. Only requested when permission is already granted or on demand. */
export const geo = $state<{
	position: LatLng | null;
	status: 'idle' | 'locating' | 'ok' | 'denied';
}>({
	position: null,
	status: 'idle'
});

export function locate(opts: { highAccuracy?: boolean } = {}): Promise<LatLng | null> {
	if (typeof navigator === 'undefined' || !navigator.geolocation) {
		geo.status = 'denied';
		return Promise.resolve(null);
	}
	geo.status = 'locating';
	return new Promise((resolve) => {
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				geo.position = { lat: pos.coords.latitude, lng: pos.coords.longitude };
				geo.status = 'ok';
				resolve(geo.position);
			},
			() => {
				geo.status = 'denied';
				resolve(null);
			},
			{ enableHighAccuracy: opts.highAccuracy ?? true, timeout: 15_000, maximumAge: 60_000 }
		);
	});
}

/** Gets the position silently if the user already granted location access. */
export async function locateIfGranted(): Promise<LatLng | null> {
	if (geo.position) return geo.position;
	try {
		const p = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
		if (p?.state === 'granted') return locate({ highAccuracy: false });
	} catch {
		// Permissions API unavailable (older Safari): don't prompt unasked.
	}
	return null;
}
