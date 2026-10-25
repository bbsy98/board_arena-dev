/* 한수 v0.7.0 — 캐시 범위 제한 및 오프라인 대응 */
'use strict';

const CACHE_PREFIX = 'hansu-board-arena-';
const CACHE_NAME = 'hansu-board-arena-v0.7.1';
const LEGACY_CACHE_NAMES = ['hansu-v0.6.0', 'hansu-board-arena-v0.6.3', 'hansu-board-arena-v0.7.0'];
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/config.js',
  './js/lessons.js',
  './js/core.js',
  './js/bootstrap.js',
  './js/sudoku-bank.js',
  './js/engines/janggi-engine.js',
  './js/engines/chess-engine.js',
  './js/engines/go-engine.js',
  './js/engines/sudoku-engine.js',
  './js/games/janggi.js',
  './js/games/chess.js',
  './js/games/go.js',
  './js/games/sudoku.js',
  './workers/janggi-worker.js',
  './workers/chess-worker.js',
  './workers/go-worker.js'
];

const appUrl = (path) => new URL(path, self.registration.scope).href;
const validResponse = (response, url) =>
  !!response &&
  response.status === 200 &&
  response.type === 'basic' &&
  new URL(url).origin === self.location.origin;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Cache successful app assets individually. A missing optional file should not
    // break installation; the app still needs its deployed files to run correctly.
    await Promise.all(APP_SHELL.map(async (path) => {
      const url = appUrl(path);
      try {
        const response = await fetch(url, { cache: 'reload' });
        if (validResponse(response, url)) await cache.put(url, response.clone());
      } catch (_) {
        // Offline-first install can be partial; network requests remain available.
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME) || LEGACY_CACHE_NAMES.includes(key))
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const requestUrl = new URL(request.url);
  const scopeUrl = new URL(self.registration.scope);
  if (requestUrl.origin !== self.location.origin ||
      !requestUrl.href.startsWith(scopeUrl.href)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    if (request.mode === 'navigate') {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          await cache.put(appUrl('./index.html'), response.clone());
        }
        return response;
      } catch (_) {
        const cachedPage = await cache.match(appUrl('./index.html'));
        if (cachedPage) return cachedPage;
        return new Response(
          '오프라인 상태이며 저장된 한수 화면을 찾을 수 없습니다. 인터넷 연결 후 다시 시도해 주세요.',
          { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
        );
      }
    }

    const cached = await cache.match(request);
    if (cached) return cached;

    try {
      const response = await fetch(request);
      if (validResponse(response, request.url)) {
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      throw error;
    }
  })());
});
