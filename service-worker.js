// ============================================
// 🍥 Ninja Mission Tracker — Service Worker
// ============================================
const CACHE_NAME = 'ninja-tracker-v1';
const urlsToCache = [
  './',
  './index.html',
  './login.html',
  './style.css',
  './script.js',
  './firebase-config.js',
  './manifest.json'
];

// Install — cache files
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate — clean old cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch — network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip Firebase & external requests
  if (event.request.url.includes('firebase') ||
      event.request.url.includes('googleapis') ||
      event.request.url.includes('gstatic') ||
      event.request.url.includes('cdnjs')) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
