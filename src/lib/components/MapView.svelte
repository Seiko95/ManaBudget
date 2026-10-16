<script lang="ts" module>
	export type MapMarker = {
		lat: number;
		lng: number;
		label: string;
		/** Circle radius in px (for "sized by amount" maps). */
		radius?: number;
		color?: string;
		href?: string;
	};
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import type * as Leaflet from 'leaflet';
	import 'leaflet/dist/leaflet.css';
	import type { LatLng } from '$lib/geo';

	let {
		markers = [],
		pin = $bindable(null),
		editable = false,
		here = null,
		class: className = 'h-64',
		label
	}: {
		markers?: MapMarker[];
		/** Draggable position pin (place editor). */
		pin?: LatLng | null;
		editable?: boolean;
		here?: LatLng | null;
		class?: string;
		label: string;
	} = $props();

	let el: HTMLDivElement;
	let L: typeof Leaflet | undefined = $state();
	let map: Leaflet.Map | undefined = $state();
	let markerLayer: Leaflet.LayerGroup | undefined;
	let pinMarker: Leaflet.Marker | undefined;
	let hereMarker: Leaflet.CircleMarker | undefined;

	const FRANCE: Leaflet.LatLngExpression = [46.6, 2.4];

	const pinIcon = () =>
		L!.divIcon({
			className: '',
			html: '<div class="mb-pin"></div>',
			iconSize: [28, 28],
			iconAnchor: [14, 28]
		});

	onMount(() => {
		let disposed = false;
		import('leaflet').then((mod) => {
			if (disposed) return;
			L = mod.default ?? mod;
			map = L.map(el, { zoomControl: true, attributionControl: true }).setView(FRANCE, 5);
			L.tileLayer(page.data.map?.tileUrl ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
				maxZoom: 19,
				attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
			}).addTo(map);
			markerLayer = L.layerGroup().addTo(map);
			if (editable)
				map.on('click', (e: Leaflet.LeafletMouseEvent) => {
					pin = { lat: e.latlng.lat, lng: e.latlng.lng };
				});
			fit();
		});
		return () => {
			disposed = true;
			map?.remove();
		};
	});

	function fit() {
		if (!map || !L) return;
		const pts: Leaflet.LatLngExpression[] = markers.map((m) => [m.lat, m.lng]);
		if (pin) pts.push([pin.lat, pin.lng]);
		if (!pts.length && here) pts.push([here.lat, here.lng]);
		if (pts.length === 1) map.setView(pts[0], 16);
		else if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [24, 24], maxZoom: 16 });
	}

	// Markers
	$effect(() => {
		if (!map || !L || !markerLayer) return;
		const fallback = '#2a78d6';
		markerLayer.clearLayers();
		for (const m of markers) {
			const c = L.circleMarker([m.lat, m.lng], {
				radius: m.radius ?? 8,
				color: '#fff',
				weight: 2,
				fillColor: m.color ?? fallback,
				fillOpacity: m.radius ? 0.55 : 0.9
			}).bindTooltip(m.label);
			if (m.href) c.on('click', () => (location.href = m.href!));
			c.addTo(markerLayer);
		}
		fit();
	});

	// Draggable pin
	$effect(() => {
		if (!map || !L) return;
		const p = pin;
		if (!p) {
			pinMarker?.remove();
			pinMarker = undefined;
			return;
		}
		if (!pinMarker) {
			pinMarker = L.marker([p.lat, p.lng], {
				draggable: editable,
				icon: pinIcon(),
				keyboard: true,
				title: label
			}).addTo(map);
			pinMarker.on('dragend', () => {
				const ll = pinMarker!.getLatLng();
				pin = { lat: ll.lat, lng: ll.lng };
			});
			map.setView([p.lat, p.lng], Math.max(map.getZoom(), 16));
		} else {
			const cur = pinMarker.getLatLng();
			if (cur.lat !== p.lat || cur.lng !== p.lng) {
				pinMarker.setLatLng([p.lat, p.lng]);
				map.panTo([p.lat, p.lng]);
			}
		}
	});

	// "You are here" dot
	$effect(() => {
		if (!map || !L) return;
		hereMarker?.remove();
		if (here)
			hereMarker = L.circleMarker([here.lat, here.lng], {
				radius: 6,
				color: '#fff',
				weight: 2,
				fillColor: '#2563eb',
				fillOpacity: 1
			}).addTo(map);
	});
</script>

<div
	bind:this={el}
	class="isolate z-0 w-full overflow-hidden rounded-xl border {className}"
	role="region"
	aria-label={label}
></div>

<style>
	:global(.mb-pin) {
		width: 28px;
		height: 28px;
		border-radius: 50% 50% 50% 0;
		background: #e34948;
		border: 3px solid white;
		transform: rotate(-45deg);
		box-shadow: 0 2px 6px rgb(0 0 0 / 0.4);
	}
	:global(.leaflet-container) {
		font: inherit;
	}
	@media (prefers-color-scheme: dark) {
		:global(.leaflet-tile-pane) {
			filter: brightness(0.75) contrast(1.1) saturate(0.8);
		}
	}
</style>
