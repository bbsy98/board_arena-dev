const CACHE='hansu-v0.6.0';
const ASSETS=["./", "./index.html", "./css/style.css", "./js/config.js", "./js/lessons.js", "./js/core.js", "./js/bootstrap.js", "./js/sudoku-bank.js", "./js/engines/janggi-engine.js", "./js/engines/chess-engine.js", "./js/engines/go-engine.js", "./js/engines/sudoku-engine.js", "./js/games/janggi.js", "./js/games/chess.js", "./js/games/go.js", "./js/games/sudoku.js", "./workers/janggi-worker.js", "./workers/chess-worker.js", "./workers/go-worker.js"];

self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put('./index.html',c));return r;}).catch(()=>caches.match('./index.html')));
  } else {
    e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return r;})));
  }
});
