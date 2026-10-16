/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

/**
 * Online-only PWA: the app shell (built JS/CSS, icons) is cached so the app
 * starts fast and installs, but pages and data always come from the network.
 * When the network is down, navigations get a small offline page.
 */
import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `manabudget-${version}`;
const SHELL = [...build, ...files.filter((f) => !f.endsWith('.DS_Store'))];
const SHELL_SET = new Set(SHELL);

const OFFLINE_HTML = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Hors ligne · ManaBudget</title>
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;padding:1rem;text-align:center;color:#111;background:#fff}
@media (prefers-color-scheme:dark){body{color:#eee;background:#0a0a0a}}button{font:inherit;padding:.6rem 1.2rem;border-radius:.5rem;border:1px solid currentColor;background:none;color:inherit}</style>
</head><body><div><p style="font-size:2.5rem;margin:0">📡</p><h1 style="font-size:1.25rem">Vous êtes hors ligne</h1>
<p>ManaBudget a besoin d’une connexion pour fonctionner.</p><button onclick="location.reload()">Réessayer</button></div></body></html>`;

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(SHELL))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => sw.clients.claim())
	);
});

sw.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') return;
	const url = new URL(req.url);
	if (url.origin !== sw.location.origin) return;

	// Static app shell: cache first (file names are content-hashed)
	if (SHELL_SET.has(url.pathname)) {
		event.respondWith(caches.match(req).then((hit) => hit ?? fetch(req)));
		return;
	}

	// Pages: network only, with an offline fallback. Data and photos are never cached.
	if (req.mode === 'navigate') {
		event.respondWith(
			fetch(req).catch(
				() =>
					new Response(OFFLINE_HTML, { headers: { 'content-type': 'text/html; charset=utf-8' } })
			)
		);
	}
});
