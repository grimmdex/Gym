// sw.js — Service worker: guarda una copia de la app en el teléfono
// para que abra sin internet.
// IMPORTANTE: cada vez que cambies algún archivo, sube el número de VERSION
// para que el teléfono descargue la versión nueva.

const VERSION = 'mi-entreno-v1';
const ARCHIVOS = [
  './',
  './index.html',
  './styles.css',
  './db.js',
  './graficas.js',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

// Al instalar: descarga y guarda todos los archivos.
self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(ARCHIVOS)));
  self.skipWaiting();
});

// Al activar: borra copias de versiones anteriores.
self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then((claves) => Promise.all(claves.filter((c) => c !== VERSION).map((c) => caches.delete(c))))
  );
  self.clients.claim();
});

// Al pedir un archivo: primero la copia guardada; si no está, la red.
self.addEventListener('fetch', (evento) => {
  if (evento.request.method !== 'GET') return;
  evento.respondWith(
    caches.match(evento.request, { ignoreSearch: true }).then((guardado) => guardado || fetch(evento.request))
  );
});
