const CACHE_NAME = 'Technics Master Edition MKII';

const assetsToCache = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './img/Technics_logo.png',
    './img/HR_logo.png',
    './img/mash_logo_t.png',
    './img/Technics_cover.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('SW: Caching App Shell');
                return cache.addAll(assetsToCache);
            })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('SW: Clearing Old Cache');
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                return response || fetch(event.request).then((fetchResponse) => {
                    // Optionnel : on pourrait mettre en cache les nouveaux fichiers ici
                    return fetchResponse;
                });
            })
            .catch(() => {
                // Si tout échoue (offline et pas en cache)
                console.log('SW: Resource not found');
            })
    );
});
