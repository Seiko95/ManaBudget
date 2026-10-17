<script lang="ts" module>
	export type MapMarker = {
		lat: number;
		lng: number;
		label: string;
		/** Second tooltip line, e.g. an amount. */
		detail?: string;
		/** Summed into the tooltip of a group of nearby markers. */
		amountCents?: number;
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
	import 'leaflet.markercluster/dist/MarkerCluster.css';
	import type { LatLng } from '$lib/geo';
	import { formatCents } from '$lib/format';
	import { t } from '$lib/i18n/fr';

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
	let markerLayer: Leaflet.MarkerClusterGroup | undefined;
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
		import('leaflet').then(async (mod) => {
			const leaflet = mod.default ?? mod;
			// The cluster plugin extends the global L
			(window as unknown as { L: typeof Leaflet }).L = leaflet;
			await import('leaflet.markercluster');
			if (disposed) return;
			L = leaflet;
			map = L.map(el, { zoomControl: true, attributionControl: true }).setView(FRANCE, 5);
			L.tileLayer(page.data.map?.tileUrl ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
				maxZoom: 19,
				attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
			}).addTo(map);
			markerLayer = L.markerClusterGroup({
				maxClusterRadius: 40,
				showCoverageOnHover: false,
				spiderfyOnMaxZoom: true,
				iconCreateFunction: clusterIcon
			}).addTo(map);
			markerLayer.on('clustermouseover', (e) => {
				const cluster = e.propagatedFrom as Leaflet.MarkerCluster;
				cluster.bindTooltip(clusterTooltip(cluster)).openTooltip();
			});
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

	const markerData = new WeakMap<Leaflet.Layer, MapMarker>();

	function childData(cluster: Leaflet.MarkerCluster): MapMarker[] {
		return cluster.getAllChildMarkers().flatMap((l) => markerData.get(l) ?? []);
	}

	function clusterIcon(cluster: Leaflet.MarkerCluster) {
		const n = cluster.getChildCount();
		const size = Math.min(48, 28 + 4 * Math.log2(n));
		return L!.divIcon({
			className: '',
			html: `<div class="mb-cluster" style="width:${size}px;height:${size}px">${n}</div>`,
			iconSize: [size, size]
		});
	}

	/** Text-only content (names come from the user, never inject them as HTML). */
	function tooltipContent(lines: { text: string; strong?: boolean }[]): HTMLElement {
		const root = document.createElement('div');
		for (const line of lines) {
			const el = document.createElement(line.strong ? 'strong' : 'div');
			el.textContent = line.text;
			el.style.display = 'block';
			root.append(el);
		}
		return root;
	}

	function clusterTooltip(cluster: Leaflet.MarkerCluster): HTMLElement {
		const items = childData(cluster);
		const withAmount = items.filter((m) => m.amountCents != null);
		const lines: { text: string; strong?: boolean }[] = [
			{ text: t.places.clusterCount.replace('{n}', String(items.length)), strong: true }
		];
		if (withAmount.length)
			lines.push({
				text: formatCents(withAmount.reduce((s, m) => s + m.amountCents!, 0)),
				strong: true
			});
		const shown = [...items].sort((a, b) => (b.amountCents ?? 0) - (a.amountCents ?? 0));
		for (const m of shown.slice(0, 5))
			lines.push({
				text: m.amountCents != null ? `${m.label} · ${formatCents(m.amountCents)}` : m.label
			});
		if (shown.length > 5)
			lines.push({ text: t.places.clusterMore.replace('{n}', String(shown.length - 5)) });
		return tooltipContent(lines);
	}

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
			}).bindTooltip(
				tooltipContent([
					{ text: m.label, strong: !!m.detail },
					...(m.detail ? [{ text: m.detail }] : [])
				])
			);
			markerData.set(c, m);
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
	:global(.mb-cluster) {
		display: grid;
		place-items: center;
		border-radius: 9999px;
		background: #2a78d6;
		color: #fff;
		font-weight: 600;
		font-size: 13px;
		border: 2px solid #fff;
		box-shadow: 0 1px 4px rgb(0 0 0 / 0.35);
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
