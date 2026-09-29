'use strict';

const CACHE_NAME = 'ad-atlas-20260929-2';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.svg',
  './pwa-192.png',
  './pwa-512.png',
  './style.css?v=20260929-2',
  './app.js?v=20260929-2',
  './leaflet.css',
  './leaflet.js',
  './data.js',
  './map.webp',
  './airdrop_2070233.png',
  './beehive.png',
  './boar_9098892.png',
  './boom.png',
  './building.png',
  './caterpillar_2470081.png',
  './coal.png',
  './coal(1).png',
  './corkboard.png',
  './cranberry_13460939.png',
  './criminal.png',
  './deer_9099080.png',
  './fire.png',
  './free-icon-ammo-3836821.png',
  './free-icon-bear-7506864.png',
  './free-icon-bio-weapon-12517479.png',
  './free-icon-bunker-2737698.png',
  './free-icon-capitol-1201843.png',
  './free-icon-green-tea-4264512.png',
  './free-icon-lotus-flower-7091498.png',
  './free-icon-puppy-1959967.png',
  './free-icon-stump-928799.png',
  './free-icon-tower-1840696.png',
  './free-icon-water-7126715.png',
  './free-icon-wooden-8555095.png',
  './ginseng.png',
  './gold-ingots.png',
  './gold-mine(1).png',
  './green-totem.png',
  './halloween.png',
  './hub_animal.png',
  './hub_lizard.png',
  './hub_monkey.png',
  './hub_vampire.png',
  './hub_werewolf.png',
  './medicine.png',
  './mushroom_9288694.png',
  './omut.png',
  './ore.png',
  './petroleum.png',
  './rabbit_523493.png',
  './sewing-machine.png',
  './star.png',
  './teleport.png',
  './totem.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
      return response;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
    return response;
  })));
});
