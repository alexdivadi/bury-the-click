import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, relative, sep } from 'node:path';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  }));
  return files.flat();
}

const files = (await filesUnder(dist)).filter((file) => !file.endsWith(`${sep}sw.js`)).sort();
const hash = createHash('sha256');
for (const file of files) hash.update(relative(dist, file)).update(await readFile(file));
const cacheName = `bury-the-click-${hash.digest('hex').slice(0, 12)}`;
const urls = ['/', ...files.filter((file) => !file.endsWith(`${sep}index.html`)).map((file) => `/${relative(dist, file).split(sep).join('/')}`)];

const serviceWorker = `const CACHE = ${JSON.stringify(cacheName)};
const ASSETS = ${JSON.stringify(urls)};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith('bury-the-click-') && name !== CACHE).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/')));
  } else {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
  }
});
`;

await writeFile(join(dist, 'sw.js'), serviceWorker);
