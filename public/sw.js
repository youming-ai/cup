// ponytail: passthrough service worker — exists only to make the app installable
// (a registered SW with a fetch handler is part of the install criteria).
// Upgrade to a real caching strategy here if/when offline support is wanted.
self.addEventListener('fetch', () => {});
