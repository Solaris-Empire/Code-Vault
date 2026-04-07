/**
 * MegaMart UK - Service Worker
 * Production-ready PWA service worker for marketplace e-commerce
 *
 * Features:
 * - Cache-first for static assets
 * - Network-first for API calls
 * - Stale-while-revalidate for product images
 * - Offline fallback page
 * - Background sync for cart operations
 */

const CACHE_VERSION = 'v1.0.0';
const STATIC_CACHE = `megamart-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `megamart-dynamic-${CACHE_VERSION}`;
const IMAGE_CACHE = `megamart-images-${CACHE_VERSION}`;
const API_CACHE = `megamart-api-${CACHE_VERSION}`;

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
  '/icons/icon.svg',
];

// API endpoints that should use network-first strategy
const API_ROUTES = [
  '/api/',
];

// Routes that should never be cached
const NO_CACHE_ROUTES = [
  '/api/auth/',
  '/api/checkout/',
  '/api/payment/',
  '/admin/',
  '/vendor/',
];

// Maximum items in dynamic cache
const MAX_DYNAMIC_CACHE_ITEMS = 50;
const MAX_IMAGE_CACHE_ITEMS = 100;

/**
 * Install Event - Cache static assets
 */
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing...');

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[ServiceWorker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[ServiceWorker] Static assets cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[ServiceWorker] Install failed:', error);
      })
  );
});

/**
 * Activate Event - Clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return cacheName.startsWith('megamart-') &&
                     cacheName !== STATIC_CACHE &&
                     cacheName !== DYNAMIC_CACHE &&
                     cacheName !== IMAGE_CACHE &&
                     cacheName !== API_CACHE;
            })
            .map((cacheName) => {
              console.log('[ServiceWorker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[ServiceWorker] Activated');
        return self.clients.claim();
      })
  );
});

/**
 * Fetch Event - Handle all network requests
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Skip routes that should never be cached
  if (NO_CACHE_ROUTES.some(route => url.pathname.startsWith(route))) {
    return;
  }

  // Handle different request types with appropriate strategies
  if (isApiRequest(url)) {
    event.respondWith(networkFirstStrategy(request));
  } else if (isImageRequest(request)) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE));
  } else if (isStaticAsset(url)) {
    event.respondWith(cacheFirstStrategy(request));
  } else {
    event.respondWith(networkFirstWithOffline(request));
  }
});

/**
 * Check if request is an API call
 */
function isApiRequest(url) {
  return API_ROUTES.some(route => url.pathname.startsWith(route));
}

/**
 * Check if request is for an image
 */
function isImageRequest(request) {
  const acceptHeader = request.headers.get('Accept') || '';
  return acceptHeader.includes('image') ||
         /\.(jpg|jpeg|png|gif|webp|svg|ico)$/i.test(new URL(request.url).pathname);
}

/**
 * Check if request is for a static asset
 */
function isStaticAsset(url) {
  return /\.(js|css|woff|woff2|ttf|eot)$/i.test(url.pathname) ||
         url.pathname.startsWith('/_next/static/');
}

/**
 * Cache-First Strategy
 * Best for static assets that rarely change
 */
async function cacheFirstStrategy(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('[ServiceWorker] Cache-first failed:', error);
    return caches.match('/offline');
  }
}

/**
 * Network-First Strategy
 * Best for API calls and dynamic content
 */
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, networkResponse.clone());

      // Limit cache size
      limitCacheSize(API_CACHE, MAX_DYNAMIC_CACHE_ITEMS);
    }

    return networkResponse;
  } catch (error) {
    console.log('[ServiceWorker] Network failed, trying cache:', request.url);
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    // Return empty JSON for API requests when offline
    return new Response(
      JSON.stringify({
        error: 'You are offline',
        offline: true,
        message: 'Please check your internet connection and try again.'
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Network-First with Offline Fallback
 * Best for HTML pages
 */
async function networkFirstWithOffline(request) {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
      limitCacheSize(DYNAMIC_CACHE, MAX_DYNAMIC_CACHE_ITEMS);
    }

    return networkResponse;
  } catch (error) {
    console.log('[ServiceWorker] Network failed for page:', request.url);

    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline');
    }

    return new Response('Offline', { status: 503 });
  }
}

/**
 * Stale-While-Revalidate Strategy
 * Best for images and content that can be slightly stale
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
        limitCacheSize(cacheName, MAX_IMAGE_CACHE_ITEMS);
      }
      return networkResponse;
    })
    .catch(() => {
      // Return placeholder image if offline and no cache
      if (!cachedResponse) {
        return new Response(
          `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
            <rect fill="#f3f4f6" width="200" height="200"/>
            <text fill="#9ca3af" font-family="sans-serif" font-size="14" text-anchor="middle" x="100" y="105">Image unavailable</text>
          </svg>`,
          { headers: { 'Content-Type': 'image/svg+xml' } }
        );
      }
    });

  return cachedResponse || fetchPromise;
}

/**
 * Limit cache size by removing oldest entries
 */
async function limitCacheSize(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();

  if (keys.length > maxItems) {
    const deleteCount = keys.length - maxItems;
    for (let i = 0; i < deleteCount; i++) {
      await cache.delete(keys[i]);
    }
  }
}

/**
 * Background Sync - Sync cart and wishlist when back online
 */
self.addEventListener('sync', (event) => {
  console.log('[ServiceWorker] Sync event:', event.tag);

  if (event.tag === 'sync-cart') {
    event.waitUntil(syncCart());
  }

  if (event.tag === 'sync-wishlist') {
    event.waitUntil(syncWishlist());
  }
});

async function syncCart() {
  try {
    const pendingCartItems = await getFromIndexedDB('pending-cart');
    if (pendingCartItems && pendingCartItems.length > 0) {
      await fetch('/api/cart/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: pendingCartItems }),
      });
      await clearFromIndexedDB('pending-cart');
      console.log('[ServiceWorker] Cart synced successfully');
    }
  } catch (error) {
    console.error('[ServiceWorker] Cart sync failed:', error);
  }
}

async function syncWishlist() {
  try {
    const pendingWishlistItems = await getFromIndexedDB('pending-wishlist');
    if (pendingWishlistItems && pendingWishlistItems.length > 0) {
      await fetch('/api/wishlist/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: pendingWishlistItems }),
      });
      await clearFromIndexedDB('pending-wishlist');
      console.log('[ServiceWorker] Wishlist synced successfully');
    }
  } catch (error) {
    console.error('[ServiceWorker] Wishlist sync failed:', error);
  }
}

/**
 * Push Notification Handler
 */
self.addEventListener('push', (event) => {
  console.log('[ServiceWorker] Push received');

  let data = {
    title: 'MegaMart UK',
    body: 'Discover amazing deals across our marketplace!',
    icon: '/icons/icon.svg',
    badge: '/icons/icon.svg',
    tag: 'megamart-notification',
    data: { url: '/' }
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    data: data.data,
    vibrate: [100, 50, 100],
    actions: [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    requireInteraction: false,
    renotify: true
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

/**
 * Notification Click Handler
 */
self.addEventListener('notificationclick', (event) => {
  console.log('[ServiceWorker] Notification clicked:', event.action);

  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If app is already open, focus it
        for (const client of clientList) {
          if (client.url.includes(self.registration.scope) && 'focus' in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        // Otherwise open new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

/**
 * Message Handler - Communication with main app
 */
self.addEventListener('message', (event) => {
  console.log('[ServiceWorker] Message received:', event.data);

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter(name => name.startsWith('megamart-'))
            .map(name => caches.delete(name))
        );
      }).then(() => {
        event.ports[0]?.postMessage({ success: true });
      })
    );
  }

  if (event.data.type === 'GET_CACHE_STATUS') {
    event.waitUntil(
      getCacheStatus().then((status) => {
        event.ports[0]?.postMessage(status);
      })
    );
  }
});

/**
 * Get cache status for debugging
 */
async function getCacheStatus() {
  const cacheNames = await caches.keys();
  const status = {};

  for (const cacheName of cacheNames) {
    if (cacheName.startsWith('megamart-')) {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      status[cacheName] = keys.length;
    }
  }

  return {
    version: CACHE_VERSION,
    caches: status,
    timestamp: new Date().toISOString()
  };
}

/**
 * IndexedDB helpers for offline data storage
 */
function getFromIndexedDB(storeName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('megamart-offline', 1);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        resolve(null);
        return;
      }
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const getRequest = store.getAll();

      getRequest.onsuccess = () => resolve(getRequest.result);
      getRequest.onerror = () => reject(getRequest.error);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pending-cart')) {
        db.createObjectStore('pending-cart', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('pending-wishlist')) {
        db.createObjectStore('pending-wishlist', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

function clearFromIndexedDB(storeName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('megamart-offline', 1);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        resolve();
        return;
      }
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const clearRequest = store.clear();

      clearRequest.onsuccess = () => resolve();
      clearRequest.onerror = () => reject(clearRequest.error);
    };
  });
}

console.log('[ServiceWorker] Script loaded - Version:', CACHE_VERSION);
