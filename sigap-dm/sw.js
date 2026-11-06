/* Service worker SIGAP-DM: menyimpan berkas aplikasi agar bisa dibuka tanpa internet.
   Ubah VERSI setiap kali Anda mengubah berkas aplikasi supaya HP memuat versi terbaru. */
const VERSI = 'sigap-dm-v1.3.1';
// './index.html' sengaja tidak di-cache terpisah: './' sudah berisi halaman yang sama
// dan menghindari masalah redirect di hosting seperti Cloudflare Workers.
const BERKAS = ['./', './css/style.css', './js/config.js', './js/data.js', './js/app.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'];

// Browser menolak respons hasil redirect untuk navigasi (ERR_FAILED), jadi salin menjadi respons bersih.
async function bersihkan(r) {
  if (!r.redirected) return r;
  return new Response(await r.blob(), { status: 200, statusText: 'OK', headers: r.headers });
}

async function simpanSemua() {
  const c = await caches.open(VERSI);
  await Promise.all(BERKAS.map(async u => {
    const r = await fetch(u, { cache: 'reload' });
    if (!r.ok) throw new Error('Gagal memuat ' + u);
    await c.put(u, await bersihkan(r));
  }));
}

self.addEventListener('install', e => {
  e.waitUntil(simpanSemua().then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSI).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // jangan campuri permintaan ke server lain
  if (url.pathname.indexOf('/dashboard/') >= 0) return; // dashboard tidak memakai cache aplikasi

  // Membuka aplikasi / pindah halaman: coba jaringan dulu, kalau offline pakai halaman tersimpan
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('./').then(r => r || caches.match(e.request)))
    );
    return;
  }

  if (url.pathname.endsWith('/js/config.js')) { // pengaturan: utamakan versi terbaru dari jaringan
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(VERSI).then(ch => ch.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
});
