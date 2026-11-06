/* SIGAP-DM — Sistem Informasi Gula Darah Prima (Diabetes Melitus)
   Aplikasi web (PWA) tanpa server. Semua data tersimpan di browser perangkat pengguna (localStorage). */
(() => {
'use strict';
const { ICONS, FOODS, RECIPES, EDU, QUIZ } = window.SIGAP;

/* =====================  Utilitas  ===================== */
const KEY = 'sigapdm.v1';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = n => String(n).padStart(2, '0');
const dKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hhmm = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
const fmt = (n, dec = 0) => (n == null || Number.isNaN(n)) ? '–' : Number(n).toLocaleString('id-ID', { maximumFractionDigits: dec });
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const fmtTgl = d => `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
const fmtTglJam = d => `${d.getDate()} ${BULAN[d.getMonth()]}, ${pad(d.getHours())}.${pad(d.getMinutes())}`;
const toLocalInput = (d = new Date()) => `${dKey(d)}T${hhmm(d)}`;
const daysAgo = n => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const sameDay = (iso, key) => dKey(new Date(iso)) === key;
const I = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;
const sum = a => a.reduce((x, y) => x + y, 0);
const avg = a => a.length ? sum(a) / a.length : null;
const JK = { L: 'Laki-laki', P: 'Perempuan' };

/* =====================  Penyimpanan  ===================== */
const DEFAULT = () => ({
  v: 1,
  profile: { nama: '', usia: '', jk: '', bb: '', tb: '', perut: '', faskes: '', kode: '', waGizi: '', waKeluarga: '', targetKalori: 1800, targetLangkah: 6000, targetMenit: 30, pid: '', consent: '', onboarded: false },
  gula: [], td: [], obat: [], obatLog: [], makan: [], langkah: {}, aktivitas: [], skrining: [], kuis: [], catatan: [], queue: [],
  settings: { notif: false, sync: false, pin: '', lastSync: '', lastPull: '', syncErr: '' }
});
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const o = JSON.parse(raw), d = DEFAULT();
      return { ...d, ...o, profile: { ...d.profile, ...(o.profile || {}) }, settings: { ...d.settings, ...(o.settings || {}) } };
    }
  } catch (e) { console.warn('Gagal memuat data', e); }
  return DEFAULT();
}
let S = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast('Data tidak dapat disimpan. Penyimpanan browser penuh atau diblokir.'); }
}
const UI = { period: 7, focus: null, gulaRes: null, skrRes: null, kuisRes: null, aktRes: null };

let toastTimer;
function toast(msg) {
  const t = $('#toast'); if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* =====================  Sinkronisasi ke Google Sheets (rekam medis online)  ===================== */
const CFG = window.SIGAP_CONFIG || {};
const syncAvail = () => !!CFG.SYNC_URL;
const syncOn = () => syncAvail() && S.settings.sync === true && !!S.settings.pin;
const localStr = iso => { const d = new Date(iso); return isNaN(d) ? String(iso) : `${dKey(d)} ${hhmm(d)}`; };
const PID_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newPid = () => 'P-' + Array.from({ length: 6 }, () => PID_ABC[Math.floor(Math.random() * PID_ABC.length)]).join('');
function ensurePid() { if (!S.profile.pid) S.profile.pid = newPid(); return S.profile.pid; }
function pasienRow() {
  const p = S.profile;
  const { onboarded, ...publik } = p;
  const row = { id: ensurePid(), nama: p.nama, kode_responden: p.kode, usia: p.usia, jenis_kelamin: JK[p.jk] || '', bb_kg: p.bb, tb_cm: p.tb, lingkar_perut_cm: p.perut, faskes: p.faskes, target_kalori: p.targetKalori, target_langkah: p.targetLangkah, target_menit: p.targetMenit, persetujuan: p.consent ? localStr(p.consent) : '', whatsapp_keluarga: p.waKeluarga };
  row._json = JSON.stringify(publik);
  return row;
}
const langkahRec = d => ({ id: 'L' + d, tgl: d, n: S.langkah[d] });
function rowOf(sh, r) { const row = rowOfBase(sh, r); row._json = JSON.stringify(r); return row; }
function rowOfBase(sh, r) {
  switch (sh) {
    case 'gula': return { id: r.id, waktu: localStr(r.t), nilai_mgdl: r.v, jenis_ukur: TIPE[r.tipe], status: klasGula(r.v, r.tipe).t, catatan: r.cat || '' };
    case 'td': return { id: r.id, waktu: localStr(r.t), sistolik: r.sis, diastolik: r.dia, nadi: r.nadi || '', status: klasTD(r.sis, r.dia).t };
    case 'makan': return { id: r.id, waktu: localStr(r.t), waktu_makan: r.waktu, makanan: r.nama, karbo_g: r.karbo, protein_g: r.protein, lemak_g: r.lemak, kkal: Math.round(kcalOf(r)) };
    case 'aktivitas': return { id: r.id, waktu: localStr(r.t), jenis: r.jenis, menit: r.menit, kkal: r.kcal };
    case 'langkah': return { id: r.id, tanggal: r.tgl, langkah: r.n };
    case 'obat': return { id: r.id, nama_obat: r.nama, dosis: r.dosis, jam_minum: r.jam.join(', '), catatan: r.cat || '', aktif: r.aktif ? 'ya' : 'tidak', mulai: r.dibuat };
    case 'minumobat': { const o = S.obat.find(m => m.id === r.obatId); return { id: r.id, waktu: localStr(r.t), nama_obat: o ? o.nama : '', jadwal: r.jam, tanggal: r.tgl }; }
    case 'skrining': return { id: r.id, waktu: localStr(r.t), skor: r.skor, kategori: r.kat };
    case 'kuis': return { id: r.id, waktu: localStr(r.t), skor: r.skor, total: r.total };
  }
  return { id: r.id };
}
function enq(op) {
  if (!syncOn()) return;
  S.queue = S.queue.filter(q => !(q.sheet === op.sheet && q.id === op.id));
  S.queue.push(op); save(); flush();
}
const qrec = (sh, r) => enq({ sheet: sh, id: r.id, row: rowOf(sh, r) });
const qdel = (sh, id) => enq({ sheet: sh, id, del: true });
const qpas = () => enq({ sheet: 'pasien', id: ensurePid(), row: pasienRow() });
function enqueueAll() {
  const q = [{ sheet: 'pasien', id: ensurePid(), row: pasienRow() }];
  const add = (sh, arr) => arr.forEach(r => q.push({ sheet: sh, id: r.id, row: rowOf(sh, r) }));
  add('gula', S.gula); add('td', S.td); add('makan', S.makan); add('aktivitas', S.aktivitas); add('obat', S.obat);
  add('minumobat', S.obatLog); add('skrining', S.skrining); add('kuis', S.kuis);
  Object.keys(S.langkah).forEach(d => add('langkah', [langkahRec(d)]));
  S.queue = q; save(); flush(true);
}
function syncStatusHtml() {
  if (!syncAvail()) return 'Fitur ini belum diaktifkan oleh peneliti. Data hanya tersimpan di HP ini.';
  if (!syncOn()) return 'Belum masuk akun. Data hanya tersimpan di HP ini.';
  const n = S.queue.length, last = S.settings.lastSync ? fmtTglJam(new Date(S.settings.lastSync)) : 'belum pernah';
  return `${n ? n + ' data menunggu dikirim' : 'Semua data sudah terkirim'} · terakhir kirim: ${last}${S.settings.syncErr && n ? `<br>Kendala terakhir: ${esc(S.settings.syncErr)}` : ''}`;
}
const refreshSyncStatus = () => { const el = $('#sync-status'); if (el) el.innerHTML = syncStatusHtml(); };
async function post(body) {
  const res = await fetch(CFG.SYNC_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ token: CFG.TOKEN || '', ...body }) });
  return res.json();
}
let flushing = false;
async function flush(manual) {
  if (!syncOn() || flushing) return;
  if (!S.queue.length) { if (manual === true) toast('Semua data sudah terkirim.'); return; }
  if (!navigator.onLine) { if (manual === true) toast('Tidak ada internet. Data dikirim otomatis nanti.'); return; }
  flushing = true;
  try {
    while (S.queue.length) {
      const batch = S.queue.slice(0, 60);
      const j = await post({ aksi: 'sync', pid: ensurePid(), pin: S.settings.pin, pasien: { id: ensurePid(), nama: S.profile.nama }, ops: batch });
      if (!j.ok) throw new Error(j.error || 'ditolak server');
      S.queue = S.queue.filter(q => !batch.includes(q));
      S.settings.lastSync = new Date().toISOString(); S.settings.syncErr = ''; save();
    }
    if (manual === true) toast('Data terkirim ke server.');
  } catch (e) {
    S.settings.syncErr = String((e && e.message) || e).slice(0, 120); save();
    if (manual === true) toast('Gagal mengirim. Data tetap aman di HP dan akan dicoba lagi.');
  } finally { flushing = false; refreshSyncStatus(); }
}

/* ----- ambil data dari server (login di perangkat lain) ----- */
const SHEET_KEY = { gula: 'gula', td: 'td', makan: 'makan', aktivitas: 'aktivitas', obat: 'obat', minumobat: 'obatLog', skrining: 'skrining', kuis: 'kuis' };
function mergeServer(d) {
  let changed = false;
  const pending = (sh, id) => S.queue.some(q => q.sheet === sh && q.id === id);
  Object.keys(SHEET_KEY).forEach(sh => {
    const key = SHEET_KEY[sh], srv = (d && d[sh]) || [], ids = new Set(srv.map(r => r.id));
    const before = JSON.stringify(S[key]);
    const byId = new Map(S[key].filter(r => ids.has(r.id) || pending(sh, r.id)).map(r => [r.id, r]));
    srv.forEach(r => { if (!pending(sh, r.id)) byId.set(r.id, r); });
    S[key] = [...byId.values()];
    if (JSON.stringify(S[key]) !== before) changed = true;
  });
  const before = JSON.stringify(S.langkah), L = {};
  Object.keys(S.langkah).forEach(k => { if (pending('langkah', 'L' + k)) L[k] = S.langkah[k]; });
  ((d && d.langkah) || []).forEach(r => { if (!pending('langkah', r.id)) L[r.tgl] = r.n; });
  S.langkah = L; if (JSON.stringify(L) !== before) changed = true;
  const bc = JSON.stringify(S.catatan || []); S.catatan = (d && d.catatan) || []; if (JSON.stringify(S.catatan) !== bc) changed = true;
  const pr = d && d.pasien && d.pasien[0];
  if (pr && !pending('pasien', S.profile.pid)) {
    const b0 = JSON.stringify(S.profile);
    Object.assign(S.profile, pr, { pid: S.profile.pid, onboarded: true });
    if (JSON.stringify(S.profile) !== b0) changed = true;
  }
  return changed;
}
let pulling = false, lastPullAt = 0;
async function tarik(manual) {
  if (!syncOn() || pulling) return;
  if (!navigator.onLine) { if (manual === true) toast('Tidak ada internet.'); return; }
  if (manual !== true && Date.now() - lastPullAt < 60000) return;
  pulling = true; lastPullAt = Date.now();
  try {
    const j = await post({ aksi: 'tarik', pid: S.profile.pid, pin: S.settings.pin });
    if (!j.ok) throw new Error(j.error || 'ditolak server');
    const changed = mergeServer(j.data);
    S.settings.lastPull = new Date().toISOString(); S.settings.syncErr = ''; save();
    if (manual === true) toast(changed ? 'Data diperbarui dari server.' : 'Data sudah yang terbaru.');
    const ae = document.activeElement;
    if (changed && !(ae && /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName))) render(true);
  } catch (e) {
    S.settings.syncErr = String((e && e.message) || e).slice(0, 120); save();
    if (manual === true) toast('Gagal memuat dari server: ' + S.settings.syncErr);
  } finally { pulling = false; refreshSyncStatus(); }
}
async function daftarAkun(pin) {
  if (!navigator.onLine) { toast('Perlu internet untuk membuat akun.'); return false; }
  const t0 = S.profile.consent, ts = new Date().toISOString();
  S.profile.consent = ts;
  for (let i = 0; i < 4; i++) {
    if (i > 0 || !S.profile.pid) S.profile.pid = newPid();
    try {
      const j = await post({ aksi: 'daftar', pid: S.profile.pid, pin, nama: S.profile.nama, row: pasienRow() });
      if (j.ok) {
        S.settings.sync = true; S.settings.pin = pin; save(); UI.newId = S.profile.pid;
        enqueueAll(); return true;
      }
      if (j.kode === 'ID_ADA') continue;
      S.profile.consent = t0; toast(j.error || 'Gagal membuat akun.'); return false;
    } catch (e) { S.profile.consent = t0; toast('Gagal terhubung ke server. Periksa internet dan alamat server.'); return false; }
  }
  S.profile.consent = t0; toast('Gagal membuat ID. Coba lagi.'); return false;
}

/* =====================  Klasifikasi & hitungan  ===================== */
function klasGula(v, tipe) {
  if (v < 70) return { c: 'low', t: 'Rendah', adv: 'Gula darah rendah. Jika masih sadar, minum ½ gelas teh manis atau jus (sekitar 15 gram gula), lalu cek lagi setelah 15 menit. Jika tidak membaik, gemetar berat, bingung, atau pingsan, segera cari bantuan medis.' };
  if (v >= 300) return { c: 'crit', t: 'Sangat tinggi', adv: 'Gula darah sangat tinggi. Hubungi tenaga kesehatan hari ini. Jika disertai mual, muntah, napas cepat, lemas berat, atau bingung, segera ke IGD.' };
  const warn = tipe === 'GDP' ? 100 : 140, hi = tipe === 'GDP' ? 126 : 200;
  if (v >= hi) return { c: 'high', t: 'Tinggi', adv: 'Gula darah tinggi. Minum air putih, hindari makanan dan minuman manis, lalu konsultasikan dengan tenaga kesehatan jika sering terjadi.' };
  if (v >= warn) return { c: 'warn', t: 'Di atas normal', adv: 'Sedikit di atas normal. Perhatikan porsi karbohidrat dan makanan manis, tetap aktif bergerak, lalu catat lagi pada waktu berikutnya.' };
  return { c: 'ok', t: 'Normal', adv: 'Gula darah dalam rentang normal. Pertahankan pola makan, aktivitas, dan minum obat sesuai anjuran.' };
}
const TIPE = { GDP: 'Puasa (GDP)', GDS: 'Sewaktu (GDS)', '2JPP': '2 jam setelah makan' };
function klasTD(s, d) {
  if (s < 90 || d < 60) return { c: 'low', t: 'Rendah' };
  if (s >= 140 || d >= 90) return { c: 'high', t: 'Tinggi' };
  if (s >= 130 || d >= 80) return { c: 'warn', t: 'Waspada' };
  return { c: 'ok', t: 'Normal' };
}
const COL = { low: '#2F6FDE', ok: '#2E9E5B', warn: '#E8710A', high: '#C8372D', crit: '#8E1B16' };
function bmi(bb, tb) {
  bb = num(bb); tb = num(tb);
  if (!bb || !tb) return null;
  const v = bb / ((tb / 100) ** 2);
  const t = v < 18.5 ? 'Kurang' : v < 23 ? 'Normal' : v < 25 ? 'Berlebih' : 'Obesitas';
  return { v, t };
}
const sortedGula = () => [...S.gula].sort((a, b) => new Date(a.t) - new Date(b.t));
const gulaSince = days => { const from = daysAgo(days - 1).getTime(); return sortedGula().filter(g => new Date(g.t).getTime() >= from); };
const kcalOf = m => 4 * (m.karbo || 0) + 4 * (m.protein || 0) + 9 * (m.lemak || 0);
function mealTotals(key) {
  const l = S.makan.filter(m => sameDay(m.t, key));
  const k = sum(l.map(m => m.karbo || 0)), p = sum(l.map(m => m.protein || 0)), f = sum(l.map(m => m.lemak || 0));
  return { k, p, f, kcal: 4 * k + 4 * p + 9 * f, n: l.length };
}
const stepsOn = key => S.langkah[key] || 0;
const aktOn = key => S.aktivitas.filter(a => sameDay(a.t, key));
const MET = { 'Jalan kaki': 3.5, 'Yoga': 2.5, 'Bersepeda': 6, 'Lainnya': 3 };

/* ----- obat ----- */
const doseLog = (obatId, tgl, jam) => S.obatLog.find(l => l.obatId === obatId && l.tgl === tgl && l.jam === jam);
function dosesFor(dk, upTo) {
  const out = [];
  S.obat.forEach(o => {
    if (!o.aktif || dk < o.dibuat) return;
    o.jam.forEach(j => { if (upTo && j > upTo) return; out.push({ o, j }); });
  });
  return out.sort((a, b) => a.j.localeCompare(b.j));
}
function adherence(days) {
  let exp = 0, got = 0;
  for (let i = 0; i < days; i++) {
    const dk = dKey(daysAgo(i));
    const l = dosesFor(dk, i === 0 ? hhmm() : null);
    exp += l.length; got += l.filter(x => doseLog(x.o.id, dk, x.j)).length;
  }
  return exp ? Math.round(got / exp * 100) : null;
}

/* ----- skrining ----- */
function hitungSkrining(a) {
  const r = [];
  const add = (label, pts) => { if (pts > 0) r.push({ label, pts }); };
  add(`Usia ${a.usia} tahun`, a.usia >= 65 ? 4 : a.usia >= 55 ? 3 : a.usia >= 45 ? 2 : 0);
  const b = bmi(a.bb, a.tb);
  if (b) add(`Indeks massa tubuh ${fmt(b.v, 1)} (${b.t.toLowerCase()})`, b.v >= 25 ? 3 : b.v >= 23 ? 1 : 0);
  add(`Lingkar perut ${a.perut} cm`, (a.jk === 'L' ? a.perut >= 90 : a.perut >= 80) ? 3 : 0);
  add('Tekanan darah tinggi', a.hip ? 2 : 0);
  add('Kurang aktivitas fisik', a.aktif ? 0 : 2);
  add('Tidak makan sayur/buah setiap hari', a.sayur ? 0 : 1);
  add('Pernah gula darah tinggi', a.pernah ? 5 : 0);
  add(a.kel === 5 ? 'Orang tua/saudara kandung dengan DM' : 'Kakek/nenek/paman/bibi dengan DM', a.kel);
  const skor = sum(r.map(x => x.pts));
  const kat = skor <= 6 ? 'Rendah' : skor <= 14 ? 'Sedang' : 'Tinggi';
  const saran = {
    Rendah: 'Pertahankan pola hidup sehat dan ulangi skrining setiap tahun.',
    Sedang: 'Mulai perbaiki pola makan dan tambah aktivitas fisik. Periksa gula darah puasa di puskesmas atau fasilitas kesehatan dalam waktu dekat.',
    Tinggi: 'Segera periksakan gula darah (puasa dan/atau HbA1c) ke fasilitas kesehatan. Hasil skrining ini bukan diagnosis.'
  }[kat];
  return { skor, kat, saran, rincian: r };
}

/* =====================  Grafik (SVG)  ===================== */
function spark(vals) {
  if (vals.length < 2) return '';
  const w = 300, h = 46, mn = Math.min(...vals), mx = Math.max(...vals), rg = (mx - mn) || 1;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - 4 - ((v - mn) / rg) * (h - 8)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="rgba(255,255,255,.75)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
}
function lineChart(o) {
  const all = o.series.flatMap(s => s.pts);
  if (!all.length) return `<div class="chart"><div class="empty-chart">Belum ada data untuk grafik.</div></div>`;
  const W = 340, H = o.h || 170, pl = 34, pr = 10, pt = 10, pb = 24;
  let tMin = Math.min(...all.map(p => p.t)), tMax = Math.max(...all.map(p => p.t));
  if (tMax === tMin) { tMin -= 43200000; tMax += 43200000; }
  let vMin = o.yMin ?? Math.floor((Math.min(...all.map(p => p.v)) - 10) / 10) * 10;
  let vMax = o.yMax ?? Math.ceil((Math.max(...all.map(p => p.v)) + 10) / 10) * 10;
  if (vMax <= vMin) vMax = vMin + 10;
  vMax = vMin + Math.ceil((vMax - vMin) / 40) * 40;
  const x = t => pl + (t - tMin) / (tMax - tMin) * (W - pl - pr);
  const y = v => pt + (1 - (v - vMin) / (vMax - vMin)) * (H - pt - pb);
  let g = '';
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const v = vMin + (vMax - vMin) * i / ticks, yy = y(v);
    g += `<line x1="${pl}" x2="${W - pr}" y1="${yy}" y2="${yy}" stroke="#E4EDE6"/><text x="${pl - 5}" y="${yy + 3}" text-anchor="end">${Math.round(v)}</text>`;
  }
  (o.bands || []).forEach(b => {
    const y1 = y(Math.min(b.to, vMax)), y2 = y(Math.max(b.from, vMin));
    if (y2 > y1) g = `<rect x="${pl}" y="${y1}" width="${W - pl - pr}" height="${y2 - y1}" fill="${b.color}"/>` + g;
  });
  let lines = '';
  o.series.forEach(s => {
    if (!s.pts.length) return;
    const pts = s.pts.map(p => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
    if (s.pts.length > 1) lines += `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`;
    s.pts.forEach(p => { lines += `<circle cx="${x(p.t).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="3.6" fill="${p.c || s.color}" stroke="#fff" stroke-width="1.2"/>`; });
  });
  const d1 = new Date(Math.min(...all.map(p => p.t))), d2 = new Date(Math.max(...all.map(p => p.t)));
  const lab = d => `${d.getDate()} ${BULAN[d.getMonth()]}`;
  const xl = `<text x="${pl}" y="${H - 6}">${lab(d1)}</text>` + (dKey(d1) !== dKey(d2) ? `<text x="${W - pr}" y="${H - 6}" text-anchor="end">${lab(d2)}</text>` : '');
  const lg = o.series.filter(s => s.name).length > 1 ? `<div class="lg">${o.series.map(s => `<span><i style="background:${s.color}"></i>${s.name}</span>`).join('')}</div>` : '';
  return `<div class="chart">${lg}<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label || 'Grafik tren')}">${g}${lines}${xl}</svg></div>`;
}
function donut(parts, top, bot) {
  const r = 52, c = 2 * Math.PI * r, total = sum(parts.map(p => p.v));
  let off = 0, segs = '';
  if (total > 0) parts.forEach(p => {
    const len = p.v / total * c;
    segs += `<circle cx="70" cy="70" r="${r}" fill="none" stroke="${p.color}" stroke-width="22" stroke-dasharray="${len.toFixed(2)} ${(c - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 70 70)"/>`;
    off += len;
  });
  return `<svg viewBox="0 0 140 140" role="img" aria-label="Komposisi karbohidrat, protein, lemak"><circle cx="70" cy="70" r="${r}" fill="none" stroke="#E4EDE6" stroke-width="22"/>${segs}<text x="70" y="70" text-anchor="middle" style="font-size:22px;font-weight:800;fill:#14211B">${top}</text><text x="70" y="86" text-anchor="middle" style="font-size:10px;fill:#58695F">${bot}</text></svg>`;
}
function gauge(p, big, small) {
  const L = Math.PI * 80, f = Math.min(Math.max(p, 0), 1) * L;
  const col = p <= 1.05 ? '#12372A' : '#E8710A';
  return `<div class="gauge"><svg viewBox="0 0 200 124" role="img" aria-label="${esc(big)} ${esc(small)}"><path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="#E4EDE6" stroke-width="18" stroke-linecap="round"/><path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="${col}" stroke-width="18" stroke-linecap="round" stroke-dasharray="${f.toFixed(1)} ${L.toFixed(1)}"/><text x="100" y="92" text-anchor="middle" style="font-size:28px;font-weight:800;fill:#14211B">${big}</text><text x="100" y="112" text-anchor="middle" style="font-size:11px;fill:#58695F">${small}</text></svg></div>`;
}
function ring(p, big, small) {
  const r = 44, c = 2 * Math.PI * r, f = Math.min(Math.max(p, 0), 1) * c;
  const prog = f > 0.5 ? `<circle cx="55" cy="55" r="${r}" fill="none" stroke="#12372A" stroke-width="12" stroke-linecap="round" stroke-dasharray="${f.toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 55 55)"/>` : '';
  return `<svg viewBox="0 0 110 110" role="img" aria-label="${esc(big)} ${esc(small)}"><circle cx="55" cy="55" r="${r}" fill="none" stroke="#C5D5CA" stroke-width="12"/>${prog}<text x="55" y="56" text-anchor="middle" style="font-size:18px;font-weight:800;fill:#14211B">${big}</text><text x="55" y="72" text-anchor="middle" style="font-size:9.5px;fill:#58695F">${small}</text></svg>`;
}

/* =====================  Potongan HTML umum  ===================== */
const top = (t, s = '', back = true) => `${back ? `<a class="back" href="#/beranda">${I('chevL')}Beranda</a>` : ''}<header class="top"><h1>${t}</h1>${s ? `<p>${s}</p>` : ''}</header>`;
const brandMark = `<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="10" fill="#12372A"/><path d="M16 5.5s7 7.3 7 12.4a7 7 0 0 1-14 0C9 12.800 16 5.500 16 5.500z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><path d="M12.500 18l2.500 2.500 4.500-5" fill="none" stroke="#F4B400" stroke-width="2.300" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const chip = (c, t) => `<span class="chip tone-${c}">${esc(t)}</span>`;
const row = (href, ico, t, sub) => `<a class="row" href="${href}"><span class="ico">${I(ico)}</span><span class="tx"><b>${t}</b><small>${sub}</small></span>${I('chev', 'go')}</a>`;
const empty = t => `<div class="empty">${t}</div>`;
const delBtn = (act, id) => `<button class="del" data-act="${act}" data-id="${id}" aria-label="Hapus catatan">${I('trash')}</button>`;
const bar = (p) => `<div class="bar"><i style="width:${Math.round(Math.min(Math.max(p, 0), 1) * 100)}%"></i></div>`;

function events(limit) {
  const ev = [];
  S.skrining.forEach(x => ev.push({ t: new Date(x.t), ico: 'clip', txt: `Skrining mandiri: berisiko ${x.kat.toLowerCase()}` }));
  S.gula.forEach(x => ev.push({ t: new Date(x.t), ico: 'drop', txt: `Gula darah: ${x.v} mg/dL (${klasGula(x.v, x.tipe).t.toLowerCase()})` }));
  S.td.forEach(x => ev.push({ t: new Date(x.t), ico: 'pulse', txt: `Tekanan darah: ${x.sis}/${x.dia} mmHg` }));
  S.makan.forEach(x => ev.push({ t: new Date(x.t), ico: 'fork', txt: `${x.waktu}: ${x.nama} (${fmt(kcalOf(x))} kkal)` }));
  S.aktivitas.forEach(x => ev.push({ t: new Date(x.t), ico: 'flame', txt: `${x.jenis} ${x.menit} menit (±${fmt(x.kcal)} kkal)` }));
  S.obatLog.forEach(x => { const o = S.obat.find(m => m.id === x.obatId); ev.push({ t: new Date(x.t), ico: 'pill', txt: `Minum obat: ${o ? o.nama : 'obat'} (${x.jam})` }); });
  S.kuis.forEach(x => ev.push({ t: new Date(x.t), ico: 'book', txt: `Kuis edukasi: ${x.skor}/${x.total}` }));
  ev.sort((a, b) => b.t - a.t);
  return ev.slice(0, limit);
}
const evRows = list => list.length ? `<div class="list">${list.map(e => `<div class="row log"><span class="ico">${I(e.ico)}</span><span class="tx"><b style="font-weight:700">${esc(e.txt)}</b><small>${fmtTglJam(e.t)}</small></span></div>`).join('')}</div>` : empty('Belum ada aktivitas. Mulai dengan mencatat gula darah.');

/* =====================  Halaman  ===================== */
function vOnboard() {
  if (UI.step === 'login') {
    return `<div style="padding-top:22px"><button class="back" data-act="to-intro" style="border:0;background:none;cursor:pointer">${I('chevL')}Kembali</button>
    <h1 style="font-size:1.6rem;font-weight:800;color:var(--pine);margin-top:8px">Masuk ke akun</h1>
    <p class="note" style="margin-top:6px">Masukkan ID pasien dan PIN Anda. Semua data Anda akan dimuat dari server.</p>
    <form class="panel" data-form="masuk" autocomplete="off">
      <label class="fld"><span>ID pasien</span><input name="pid" maxlength="8" required placeholder="P-XXXXXX" autocapitalize="characters" style="text-transform:uppercase"></label>
      <label class="fld"><span>PIN (6 angka)</span><input name="pin" type="password" inputmode="numeric" maxlength="6" required autocomplete="current-password"></label>
      <button class="btn gold" type="submit" style="margin-top:18px">Masuk</button>
    </form></div>`;
  }
  if (UI.step === 2) {
    const p = S.profile;
    return `<div style="padding-top:22px"><h1 style="font-size:1.6rem;font-weight:800;color:var(--pine)">Kenalan dulu</h1>
    <p class="note" style="margin-top:6px">Data ini hanya tersimpan di HP Anda dan bisa diubah kapan saja di menu Profil.</p>
    <form class="panel" data-form="onboard" autocomplete="off">
      <label class="fld"><span>Nama panggilan</span><input name="nama" value="${esc(p.nama)}" maxlength="40" required placeholder="mis. Budi"></label>
      <div class="two"><label class="fld"><span>Usia (tahun)</span><input name="usia" type="number" inputmode="numeric" min="1" max="120" required value="${esc(p.usia)}"></label>
      <label class="fld"><span>Jenis kelamin</span><select name="jk" required><option value="">Pilih</option><option value="L" ${p.jk === 'L' ? 'selected' : ''}>Laki-laki</option><option value="P" ${p.jk === 'P' ? 'selected' : ''}>Perempuan</option></select></label></div>
      <div class="two"><label class="fld"><span>Berat badan (kg)</span><input name="bb" type="number" inputmode="decimal" step="0.1" min="10" max="300" value="${esc(p.bb)}"></label>
      <label class="fld"><span>Tinggi badan (cm)</span><input name="tb" type="number" inputmode="decimal" step="0.1" min="80" max="230" value="${esc(p.tb)}"></label></div>
      <label class="fld"><span>Puskesmas / fasilitas kesehatan (opsional)</span><input name="faskes" maxlength="60" value="${esc(p.faskes)}" placeholder="mis. Puskesmas Gambir"></label>
      ${syncAvail() ? `<label class="check" style="margin-top:14px"><input type="checkbox" name="consent"><span>Saya bersedia catatan kesehatan saya, termasuk nama, dikirim ke peneliti untuk keperluan penelitian tesis ini dan disimpan di akun saya. Saya bisa menghentikannya kapan saja di menu Profil. Jika tidak dicentang, data hanya tersimpan di HP ini.</span></label>
      <label class="fld"><span>PIN akun (6 angka, wajib jika dicentang)</span><input name="pin" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password" placeholder="mis. 482915"></label>
      <p class="note">Dengan ID pasien dan PIN ini Anda bisa masuk dari HP atau laptop lain. Jangan lupakan PIN Anda.</p>` : ''}
      <button class="btn gold" type="submit" style="margin-top:18px">Simpan dan masuk</button>
    </form></div>`;
  }
  return `<div class="intro">
    <div class="logo">${brandMark}</div>
    <h1>SIGAP-DM</h1>
    <p class="sub">Sistem Informasi Gula Darah Prima untuk diabetes melitus. Mitra cerdas pengelolaan mandiri Anda.</p>
    <ul>
      <li><span class="ico">${I('drop')}</span><span><b>Catat dan pantau</b><br><small class="legal">Gula darah, tekanan darah, dan tren dari waktu ke waktu.</small></span></li>
      <li><span class="ico">${I('pill')}</span><span><b>Jangan lewatkan dosis</b><br><small class="legal">Jadwal obat dan pengingat harian.</small></span></li>
      <li><span class="ico">${I('fork')}</span><span><b>Makan dan bergerak lebih terarah</b><br><small class="legal">Pola makan, aktivitas fisik, dan edukasi mandiri.</small></span></li>
    </ul>
    <div class="push">
      <p class="legal" style="margin-bottom:14px">Aplikasi ini alat bantu pencatatan dan edukasi, bukan pengganti pemeriksaan atau saran dokter. Data tersimpan hanya di perangkat Anda.</p>
      <button class="btn gold" data-act="start">MULAI</button>
      ${syncAvail() ? `<button class="btn" data-act="to-login" style="margin-top:10px">Sudah punya akun? Masuk</button>` : ''}
    </div></div>`;
}

function vHome() {
  const p = S.profile, now = new Date(), h = now.getHours();
  const sapa = h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
  const gs = sortedGula(), last = gs[gs.length - 1];
  const dk = dKey(), doses = dosesFor(dk);
  const taken = doses.filter(x => doseLog(x.o.id, dk, x.j)).length;
  const late = doses.filter(x => !doseLog(x.o.id, dk, x.j) && x.j <= hhmm()).length;
  const mt = mealTotals(dk), st = stepsOn(dk);
  let hero;
  if (last) {
    const k = klasGula(last.v, last.tipe);
    hero = `<section class="hero tone-${k.c}" aria-label="Gula darah terakhir">
      <div class="hero-lab">Gula darah terakhir · ${TIPE[last.tipe]} · ${fmtTglJam(new Date(last.t))}</div>
      <div class="hero-num"><span>${last.v}</span><small>mg/dL</small></div>
      <div class="hero-state"><i></i>${k.t}</div>
      ${spark(gs.slice(-10).map(g => g.v))}
      <a class="btn gold" href="#/gula">${I('plus')}Catat gula darah</a></section>`;
  } else {
    hero = `<section class="hero tone-none"><div class="hero-lab">Gula darah terakhir</div>
      <div class="hero-num"><span>––</span><small>mg/dL</small></div>
      <p class="empty-note">Belum ada catatan. Catat hasil pertama Anda untuk mulai melihat tren.</p>
      <a class="btn gold" href="#/gula">${I('plus')}Catat gula darah</a></section>`;
  }
  const sk = [...S.skrining].sort((a, b) => new Date(b.t) - new Date(a.t))[0];
  return `<div class="brandbar"><div class="brand">${brandMark}SIGAP-DM</div>
      <a class="bell" href="#/obat" aria-label="Obat hari ini${late ? `, ${late} terlewat` : ''}">${I('bell')}${late ? `<b>${late}</b>` : ''}</a></div>
    <div class="greet"><h1>${sapa}${p.nama ? `, Kak ${esc(p.nama)}` : ''}</h1>${p.faskes ? `<p>${esc(p.faskes)}</p>` : ''}</div>
    ${UI.newId ? `<div class="panel sage" style="margin:0 0 14px"><b>Akun berhasil dibuat</b><p style="margin-top:4px">ID pasien Anda: <b style="font-size:1.25rem;letter-spacing:.06em">${esc(UI.newId)}</b></p><p class="note" style="margin-top:4px">Catat ID ini dan PIN Anda untuk masuk dari HP atau laptop lain. ID juga tampil di menu Profil.</p><button class="btn sm" data-act="dismiss-id" style="margin-top:10px">Sudah saya catat</button></div>` : ''}${hero}
    <div class="today" aria-label="Ringkasan hari ini">
      <div class="meter"><b>Obat</b>${bar(doses.length ? taken / doses.length : 0)}<span>${doses.length ? `${taken}/${doses.length}` : '–'}</span></div>
      <div class="meter"><b>Langkah</b>${bar(st / (num(p.targetLangkah) || 6000))}<span>${fmt(st)}</span></div>
      <div class="meter"><b>Kalori</b>${bar(mt.kcal / (num(p.targetKalori) || 1800))}<span>${fmt(mt.kcal)}</span></div>
    </div>
    <div class="sec"><h2 class="sec-title">Pantau</h2><div class="list">
      ${row('#/gula', 'drop', 'Pencatatan gula darah', 'Catat hasil dan lihat statusnya')}
      ${row('#/obat', 'pill', 'Kepatuhan obat', doses.length ? `${taken} dari ${doses.length} dosis hari ini` : 'Atur jadwal minum obat')}
      ${row('#/pasien', 'pulse', 'Kondisi pasien', (S.catatan || []).length ? 'Ada catatan dari tenaga kesehatan' : 'Data vital dan grafik tekanan darah')}
      ${row('#/laporan', 'data', 'Laporan dan grafik tren', 'Ringkasan, cetak, dan bagikan')}
    </div></div>
    <div class="sec"><h2 class="sec-title">Gaya hidup</h2><div class="list">
      ${row('#/makan', 'fork', 'Pola makan', 'Karbohidrat, protein, lemak harian')}
      ${row('#/aktivitas', 'flame', 'Aktivitas fisik', 'Langkah, latihan, dan target harian')}
    </div></div>
    <div class="sec"><h2 class="sec-title">Kenali dan pelajari</h2><div class="list">
      ${row('#/skrining', 'clip', 'Skrining risiko mandiri', sk ? `Terakhir: berisiko ${sk.kat.toLowerCase()} (${fmtTgl(new Date(sk.t))})` : 'Cek risiko diabetes dalam 2 menit')}
      ${row('#/belajar', 'book', 'Edukasi mandiri', 'Materi singkat dan kuis')}
    </div></div>
    <div class="sec"><h2 class="sec-title">Aktivitas terkini<a href="#/laporan">Lihat semua</a></h2>${evRows(events(4))}</div>`;
}

function vGula() {
  const list = [...S.gula].sort((a, b) => new Date(b.t) - new Date(a.t));
  const rs = UI.gulaRes; UI.gulaRes = null;
  const res = rs ? `<div class="panel tone-${rs.c}" style="border-left:6px solid var(--tone)"><b style="font-size:1.15rem">${rs.v} mg/dL · ${esc(rs.t)}</b><p style="margin-top:6px">${esc(rs.adv)}</p></div>` : '';
  const pts = gulaSince(30).map(g => ({ t: new Date(g.t).getTime(), v: g.v, c: COL[klasGula(g.v, g.tipe).c] }));
  return `${top('Catat gula darah', 'Isi hasil dari alat cek gula darah Anda.')}
  <form class="panel" data-form="gula" autocomplete="off">
    <label class="fld big"><span>Hasil pengukuran</span><div class="inp-unit"><input name="v" type="number" inputmode="decimal" min="20" max="900" step="1" required placeholder="mis. 110"><b>mg/dL</b></div></label>
    <fieldset class="seg"><legend>Jenis pengukuran</legend>
      <label><input type="radio" name="tipe" value="GDP" checked><span>Puasa</span></label>
      <label><input type="radio" name="tipe" value="GDS"><span>Sewaktu</span></label>
      <label><input type="radio" name="tipe" value="2JPP"><span>2 jam setelah makan</span></label>
    </fieldset>
    <label class="fld"><span>Waktu</span><input type="datetime-local" name="t" value="${toLocalInput()}" required></label>
    <label class="fld"><span>Catatan (opsional)</span><input name="cat" maxlength="120" placeholder="mis. sebelum sarapan"></label>
    <button class="btn gold" type="submit" style="margin-top:16px">Simpan catatan</button>
  </form>
  ${res}
  <div class="sec"><h2 class="sec-title">Tren 30 hari terakhir</h2>${lineChart({ series: [{ pts, color: '#12372A' }], bands: [{ from: 70, to: 140, color: 'rgba(46,158,91,.13)' }], yMin: 40, label: 'Grafik gula darah' })}
  <p class="note">Area hijau menandai kisaran normal (70–140 mg/dL).</p></div>
  <div class="sec"><h2 class="sec-title">Riwayat</h2>${list.length ? `<div class="list">${list.slice(0, 20).map(g => { const k = klasGula(g.v, g.tipe); return `<div class="row log tone-${k.c}"><span class="val">${g.v}</span><span class="tx"><b style="font-weight:700">${chip(k.c, k.t)}</b><small>${TIPE[g.tipe]} · ${fmtTglJam(new Date(g.t))}${g.cat ? ' · ' + esc(g.cat) : ''}</small></span>${delBtn('del-gula', g.id)}</div>`; }).join('')}</div>` : empty('Belum ada catatan gula darah.')}</div>`;
}

function vObat() {
  const dk = dKey(), hm = hhmm(), doses = dosesFor(dk);
  const ad = adherence(7);
  const hmMin = hm => { const [a, b] = hm.split(':').map(Number); return a * 60 + b; };
  const notifOk = ('Notification' in window) && Notification.permission === 'granted' && S.settings.notif;
  const list = doses.length ? doses.map(({ o, j }) => {
    const lg = doseLog(o.id, dk, j);
    const lateMin = hmMin(hm) - hmMin(j);
    const st = lg ? `Diminum ${hhmm(new Date(lg.t))}` : lateMin > 60 ? 'Terlewat' : lateMin >= 0 ? 'Saatnya minum' : 'Belum waktunya';
    return `<div class="dose ${lg ? 'done' : ''} ${!lg && lateMin > 60 ? 'late' : ''}"><span class="tm">${j}</span><span class="nm"><b>${esc(o.nama)}</b><small>${esc(o.dosis)}${o.cat ? ' · ' + esc(o.cat) : ''} · ${st}</small></span>
      <button class="take" data-act="take" data-obat="${o.id}" data-jam="${j}" aria-pressed="${!!lg}">${lg ? 'Sudah ✓' : 'Sudah minum'}</button></div>`;
  }).join('') : empty('Belum ada jadwal obat. Tambahkan obat Anda di bawah.');
  return `${top('Kepatuhan obat', 'Tandai setiap dosis agar tidak ada yang terlewat.')}
  <div class="panel sage ringwrap">${ring((ad ?? 0) / 100, ad == null ? '–' : ad + '%', '7 hari')}<div><b>Kepatuhan 7 hari</b><p class="note" style="margin-top:4px">${ad == null ? 'Akan muncul setelah ada jadwal obat.' : ad >= 80 ? 'Bagus, pertahankan.' : 'Coba pasang pengingat agar lebih konsisten.'}</p></div></div>
  <div class="sec"><h2 class="sec-title">Jadwal hari ini</h2><div class="list">${list}</div></div>
  <div class="sec"><h2 class="sec-title">Pengingat</h2>
    <button class="btn ${notifOk ? 'pine' : ''}" data-act="notif">${I('bell')}${notifOk ? 'Pengingat aktif (ketuk untuk matikan)' : 'Aktifkan pengingat'}</button>
    <p class="note">Pengingat berbunyi saat aplikasi terbuka atau berjalan di latar belakang. Browser HP tidak menjamin alarm saat aplikasi tertutup, jadi pasang juga alarm bawaan HP.</p></div>
  <div class="sec"><h2 class="sec-title">Tambah obat</h2>
  <form class="panel" data-form="obat" autocomplete="off">
    <label class="fld"><span>Nama obat</span><input name="nama" required maxlength="50" placeholder="mis. Metformin"></label>
    <label class="fld"><span>Dosis sesuai resep</span><input name="dosis" required maxlength="40" placeholder="mis. 1 tablet 500 mg"></label>
    <div class="fld"><span>Jam minum</span><div class="time-inputs" id="jam-wrap"><input type="time" name="jam" value="07:00" required aria-label="Jam minum 1"></div>
      <button type="button" class="btn sm" data-act="add-jam" style="margin-top:10px">${I('plus')}Tambah jam</button></div>
    <label class="fld"><span>Catatan (opsional)</span><input name="cat" maxlength="60" placeholder="mis. sesudah makan"></label>
    <p class="note box">Isi dosis persis seperti di resep dokter. Aplikasi ini tidak menentukan atau mengubah dosis.</p>
    <button class="btn gold" type="submit" style="margin-top:14px">Simpan obat</button>
  </form></div>
  ${S.obat.length ? `<div class="sec"><h2 class="sec-title">Daftar obat</h2><div class="list">${S.obat.map(o => `<div class="row log"><span class="ico">${I('pill')}</span><span class="tx"><b>${esc(o.nama)}${o.aktif ? '' : ' (dijeda)'}</b><small>${esc(o.dosis)} · ${o.jam.join(', ')}</small></span><button class="del" data-act="toggle-obat" data-id="${o.id}" aria-label="${o.aktif ? 'Jeda obat' : 'Aktifkan obat'}" style="width:auto;padding:0 10px;border-radius:12px;font-size:.82rem;font-weight:700">${o.aktif ? 'Jeda' : 'Aktifkan'}</button>${delBtn('del-obat', o.id)}</div>`).join('')}</div></div>` : ''}`;
}

function vMakan() {
  const dk = dKey(), mt = mealTotals(dk), p = S.profile;
  const tgt = num(p.targetKalori) || 1800;
  const hr = new Date().getHours();
  const def = hr < 10 ? 'Sarapan' : hr < 15 ? 'Makan siang' : hr < 19 ? 'Camilan' : 'Makan malam';
  const kk = 4 * mt.k, kp = 4 * mt.p, kf = 9 * mt.f, tot = kk + kp + kf || 1;
  const pc = { k: Math.round(kk / tot * 100), p: Math.round(kp / tot * 100), f: Math.round(kf / tot * 100) };
  const st = (v, a, b) => mt.kcal === 0 ? '' : v < a ? 'di bawah anjuran' : v > b ? 'di atas anjuran' : 'sesuai anjuran';
  const today = S.makan.filter(m => sameDay(m.t, dk)).sort((a, b) => new Date(a.t) - new Date(b.t));
  let wk = '';
  for (let i = 0; i < 7; i++) {
    const d = daysAgo(i), k = dKey(d), t = mealTotals(k);
    const g = S.gula.filter(x => sameDay(x.t, k)).map(x => x.v), td = S.td.filter(x => sameDay(x.t, k));
    wk += `<tr><td>${HARI[d.getDay()]} ${d.getDate()}</td><td>${t.n ? fmt(t.kcal) : '–'}</td><td>${t.n ? fmt(t.k) + ' g' : '–'}</td><td>${g.length ? fmt(avg(g)) : '–'}</td><td>${td.length ? `${fmt(avg(td.map(x => x.sis)))}/${fmt(avg(td.map(x => x.dia)))}` : '–'}</td></tr>`;
  }
  return `${top('Pola makan', 'Catat makanan agar komposisi harian lebih seimbang.')}
  <div class="panel"><div class="dn">${donut([{ v: kk, color: '#12372A' }, { v: kp, color: '#F4B400' }, { v: kf, color: '#E8710A' }], mt.kcal ? pc.k + '%' : '–', 'karbohidrat')}
    <div class="lgd">
      <div><i style="background:#12372A"></i><span><b>Karbohidrat ${pc.k}% · ${fmt(mt.k)} g</b><small>Anjuran 45–65% ${st(pc.k, 45, 65) ? '· ' + st(pc.k, 45, 65) : ''}</small></span></div>
      <div><i style="background:#F4B400"></i><span><b>Protein ${pc.p}% · ${fmt(mt.p)} g</b><small>Anjuran 10–20% ${st(pc.p, 10, 20) ? '· ' + st(pc.p, 10, 20) : ''}</small></span></div>
      <div><i style="background:#E8710A"></i><span><b>Lemak ${pc.f}% · ${fmt(mt.f)} g</b><small>Anjuran 20–25% ${st(pc.f, 20, 25) ? '· ' + st(pc.f, 20, 25) : ''}</small></span></div>
    </div></div>
    ${gauge(mt.kcal / tgt, fmt(mt.kcal), `dari target ${fmt(tgt)} kkal`)}
    <p class="note">Target kalori bisa diatur di menu Profil, idealnya bersama ahli gizi.</p></div>
  <div class="sec"><h2 class="sec-title">Tambah makanan</h2>
  <form class="panel" data-form="makan" autocomplete="off" id="form-makan">
    <fieldset class="seg" style="margin-top:0"><legend>Waktu makan</legend>
      ${['Sarapan', 'Makan siang', 'Makan malam', 'Camilan'].map(w => `<label><input type="radio" name="waktu" value="${w}" ${w === def ? 'checked' : ''}><span>${w}</span></label>`).join('')}
    </fieldset>
    <label class="fld"><span>Nama makanan</span><input name="nama" list="foods" required maxlength="60" placeholder="ketik atau pilih, mis. Nasi putih"></label>
    <datalist id="foods">${FOODS.map(f => `<option value="${esc(f[0])}">${esc(f[1])}</option>`).join('')}</datalist>
    <label class="fld"><span>Jumlah porsi <small id="porsi-info" style="font-weight:500;color:var(--muted)"></small></span><input name="porsi" type="number" inputmode="decimal" step="0.5" min="0.5" max="10" value="1" required></label>
    <div class="three-col" style="margin-top:14px">
      <label class="fld" style="margin:0"><span>Karbo (g)</span><input name="karbo" type="number" inputmode="decimal" step="0.1" min="0" value="0" required></label>
      <label class="fld" style="margin:0"><span>Protein (g)</span><input name="protein" type="number" inputmode="decimal" step="0.1" min="0" value="0" required></label>
      <label class="fld" style="margin:0"><span>Lemak (g)</span><input name="lemak" type="number" inputmode="decimal" step="0.1" min="0" value="0" required></label>
    </div>
    <p class="note">Angka per porsi terisi otomatis untuk makanan yang dikenal. Nilainya perkiraan; sesuaikan dengan label kemasan atau saran ahli gizi.</p>
    <button class="btn gold" type="submit" style="margin-top:14px">Simpan makanan</button>
  </form></div>
  <div class="sec"><h2 class="sec-title">Hari ini</h2>${today.length ? `<div class="list">${today.map(m => `<div class="row log"><span class="tx"><b style="font-weight:700">${esc(m.nama)}</b><small>${esc(m.waktu)} · ${fmt(kcalOf(m))} kkal · K${fmt(m.karbo)} P${fmt(m.protein)} L${fmt(m.lemak)}</small></span>${delBtn('del-makan', m.id)}</div>`).join('')}</div>` : empty('Belum ada makanan yang dicatat hari ini.')}</div>
  <div class="sec"><h2 class="sec-title">Makan dan gula darah, 7 hari</h2>
    <table class="tbl"><thead><tr><th>Hari</th><th>kkal</th><th>Karbo</th><th>Gula</th><th>TD</th></tr></thead><tbody>${wk}</tbody></table>
    <p class="note">Gula = rata-rata mg/dL, TD = rata-rata tekanan darah. Gunakan untuk melihat pola, bukan untuk menilai satu hari.</p></div>
  <div class="sec"><h2 class="sec-title">Resep sehat</h2>${RECIPES.map(r => `<details class="recipe"><summary><span>${esc(r.t)}<small>${esc(r.info)}</small></span>${I('chev')}</summary><div class="body"><h4>Bahan</h4><ul>${r.bahan.map(b => `<li>${esc(b)}</li>`).join('')}</ul><h4>Langkah</h4><ul>${r.langkah.map(b => `<li>${esc(b)}</li>`).join('')}</ul></div></details>`).join('')}</div>
  <div class="sec"><button class="btn pine" data-act="wa-gizi">${I('chat')}Konsultasi ahli gizi via WhatsApp</button>
  <p class="note">Nomor ahli gizi diatur di menu Profil. Pesan akan terbuka di WhatsApp dan baru terkirim setelah Anda menekan kirim.</p></div>`;
}

function vAktivitas() {
  const p = S.profile, dk = dKey();
  const st = stepsOn(dk), tg = num(p.targetLangkah) || 6000, tm = num(p.targetMenit) || 30;
  const today = aktOn(dk), mnt = sum(today.map(a => a.menit)), kc = sum(today.map(a => a.kcal));
  let wmin = 0; for (let i = 0; i < 7; i++) wmin += sum(aktOn(dKey(daysAgo(i))).map(a => a.menit));
  const quick = (j, label) => `<div class="row log"><span class="tx"><b>${label}</b></span>${[15, 30, 45].map(m => `<button class="btn sm" data-act="quick-akt" data-jenis="${j}" data-menit="${m}" style="min-width:64px;padding:8px 10px">${m} mnt</button>`).join('<span style="width:6px"></span>')}</div>`;
  const rs = UI.aktRes; UI.aktRes = null;
  return `${top('Aktivitas fisik', 'Pantau langkah, catat latihan, dan capai target harian.')}
  <div class="panel sage ringwrap">${ring(st / tg, fmt(st), `target ${fmt(tg)}`)}<div>
    <b>Langkah hari ini</b>
    <p class="note" style="margin-top:4px">Latihan hari ini: ${fmt(mnt)} dari ${fmt(tm)} menit target</p>
    <p class="note" style="margin-top:2px">Kalori terbakar dari latihan: ±${fmt(kc)} kkal</p></div></div>
  <form class="panel" data-form="langkah" autocomplete="off"><label class="fld"><span>Isi total langkah hari ini</span><div class="inp-unit"><input name="n" type="number" inputmode="numeric" min="0" max="100000" required value="${st || ''}" placeholder="mis. 3000"><b>langkah</b></div></label>
    <p class="note">Salin dari aplikasi kesehatan di HP atau jam tangan Anda.</p>
    <button class="btn" type="submit" style="margin-top:12px">Simpan langkah</button></form>
  <div class="sec"><h2 class="sec-title">Catat latihan cepat</h2><div class="list">
    ${quick('Jalan kaki', 'Jalan kaki')}${quick('Yoga', 'Yoga')}${quick('Bersepeda', 'Bersepeda')}</div>
  <p class="note">Kalori dihitung dari perkiraan intensitas, berat badan (${p.bb ? fmt(num(p.bb)) + ' kg' : 'belum diisi, dipakai 60 kg'}), dan lama latihan.</p></div>
  <div class="sec"><h2 class="sec-title">Latihan lain</h2>
  <form class="panel" data-form="akt" autocomplete="off" style="margin-top:0">
    <div class="two"><label class="fld"><span>Jenis</span><select name="jenis">${Object.keys(MET).map(j => `<option>${j}</option>`).join('')}</select></label>
    <label class="fld"><span>Lama (menit)</span><input name="menit" type="number" inputmode="numeric" min="1" max="600" required value="30"></label></div>
    <button class="btn" type="submit" style="margin-top:14px">Simpan latihan</button></form></div>
  <div class="sec"><h2 class="sec-title">Target mingguan</h2><div class="panel" style="margin-top:0"><div class="meter" style="grid-template-columns:1fr auto"><b>${fmt(wmin)} dari 150 menit</b><span>${Math.min(100, Math.round(wmin / 150 * 100))}%</span></div>${bar(wmin / 150)}</div></div>
  <div class="sec"><h2 class="sec-title">Skrining aktivitas</h2><p class="note" style="margin:-4px 0 4px">Jawab singkat untuk mendapat saran jenis aktivitas yang cocok.</p>
  <form class="panel" data-form="skrAkt" style="margin-top:8px">
    <label class="check"><input type="checkbox" name="lutut"><span>Nyeri lutut atau sendi saat berjalan</span></label>
    <label class="check"><input type="checkbox" name="kaki"><span>Kaki kesemutan, baal, atau ada luka</span></label>
    <label class="check"><input type="checkbox" name="jantung"><span>Nyeri dada atau sesak saat aktivitas ringan</span></label>
    <label class="check"><input type="checkbox" name="lama"><span>Sudah lama tidak berolahraga</span></label>
    <button class="btn pine" type="submit" style="margin-top:12px">Lihat saran</button>
    <div id="akt-saran" aria-live="polite">${rs || ''}</div></form></div>`;
}
function saranAktivitas(f) {
  const v = n => f.elements[n].checked;
  if (v('jantung')) return `<div class="note box" style="margin-top:14px"><b>Konsultasi dulu.</b> Nyeri dada atau sesak saat aktivitas ringan perlu diperiksa dokter sebelum Anda mulai berolahraga.</div>`;
  const s = [];
  if (v('kaki')) s.push('Pilih sepeda statis atau senam kursi dulu, dan periksa kaki setiap hari. Hindari berjalan jauh tanpa alas kaki.');
  if (v('lutut')) s.push('Pilih bersepeda, renang, atau yoga ringan. Hindari gerakan melompat.');
  if (!v('kaki') && !v('lutut')) s.push('Jalan cepat 30 menit, 5 hari seminggu, adalah awal yang baik. Boleh digabung dengan yoga ringan.');
  if (v('lama')) s.push('Mulai 10 menit per hari, lalu tambah 5 menit tiap minggu.');
  s.push('Jika memakai insulin atau obat penurun gula, bawa sumber gula (permen atau teh manis) saat berolahraga.');
  return `<div class="note box" style="margin-top:14px"><ul style="margin:0;padding-left:18px">${s.map(x => `<li>${x}</li>`).join('')}</ul></div>`;
}

function vSkrining() {
  const p = S.profile, rs = UI.skrRes; UI.skrRes = null;
  const yn = (n, y = 'Ya', t = 'Tidak') => `<fieldset class="seg" style="margin-top:6px"><label><input type="radio" name="${n}" value="1" required><span>${y}</span></label><label><input type="radio" name="${n}" value="0"><span>${t}</span></label></fieldset>`;
  const hist = [...S.skrining].sort((a, b) => new Date(b.t) - new Date(a.t));
  const tone = { Rendah: 'ok', Sedang: 'warn', Tinggi: 'high' };
  const res = rs ? `<div class="panel tone-${tone[rs.kat]}" style="border-left:6px solid var(--tone)"><b style="font-size:1.2rem">Berisiko ${rs.kat.toLowerCase()} · skor ${rs.skor}</b><p style="margin-top:6px">${esc(rs.saran)}</p>
    ${rs.rincian.length ? `<p class="grp-title" style="margin-top:12px">Yang menambah skor</p><ul style="margin:0;padding-left:18px;font-size:.92rem">${rs.rincian.map(r => `<li>${esc(r.label)}: +${r.pts}</li>`).join('')}</ul>` : ''}</div>` : '';
  return `${top('Skrining risiko mandiri', 'Perkiraan risiko diabetes dari faktor yang Anda ketahui.')}
  ${res}
  <form class="panel" data-form="skrining" autocomplete="off">
    <div class="two"><label class="fld"><span>Usia (tahun)</span><input name="usia" type="number" inputmode="numeric" min="1" max="120" required value="${esc(p.usia)}"></label>
    <label class="fld"><span>Jenis kelamin</span><select name="jk" required><option value="">Pilih</option><option value="L" ${p.jk === 'L' ? 'selected' : ''}>Laki-laki</option><option value="P" ${p.jk === 'P' ? 'selected' : ''}>Perempuan</option></select></label></div>
    <div class="two"><label class="fld"><span>Berat badan (kg)</span><input name="bb" type="number" inputmode="decimal" step="0.1" min="10" max="300" required value="${esc(p.bb)}"></label>
    <label class="fld"><span>Tinggi badan (cm)</span><input name="tb" type="number" inputmode="decimal" step="0.1" min="80" max="230" required value="${esc(p.tb)}"></label></div>
    <label class="fld"><span>Lingkar perut (cm)</span><input name="perut" type="number" inputmode="decimal" step="0.5" min="40" max="200" required value="${esc(p.perut)}"></label>
    <div class="q"><p>Apakah Anda pernah didiagnosis tekanan darah tinggi atau minum obat tekanan darah?</p>${yn('hip')}</div>
    <div class="q"><p>Apakah Anda berolahraga sedikitnya 30 menit hampir setiap hari?</p>${yn('aktif')}</div>
    <div class="q"><p>Apakah Anda makan sayur atau buah setiap hari?</p>${yn('sayur')}</div>
    <div class="q"><p>Apakah pernah diberi tahu gula darah Anda tinggi (misalnya saat sakit, hamil, atau pemeriksaan)?</p>${yn('pernah')}</div>
    <div class="q"><p>Apakah ada keluarga dengan diabetes?</p>
      <fieldset class="seg" style="margin-top:6px"><label><input type="radio" name="kel" value="0" required><span>Tidak ada</span></label><label><input type="radio" name="kel" value="3"><span>Kakek/nenek, paman/bibi</span></label><label><input type="radio" name="kel" value="5"><span>Orang tua/saudara kandung</span></label></fieldset></div>
    <button class="btn gold" type="submit" style="margin-top:20px">Lihat hasil</button>
    <p class="note box">Ini alat bantu awal, bukan diagnosis. Skor memakai bobot sederhana yang diadaptasi untuk penelitian; untuk penegakan diagnosis tetap perlu pemeriksaan laboratorium.</p>
  </form>
  <div class="sec"><h2 class="sec-title">Riwayat skrining</h2>${hist.length ? `<div class="list">${hist.map(h => `<div class="row log tone-${tone[h.kat]}"><span class="val">${h.skor}</span><span class="tx"><b style="font-weight:700">${chip(tone[h.kat], 'Berisiko ' + h.kat.toLowerCase())}</b><small>${fmtTgl(new Date(h.t))}</small></span></div>`).join('')}</div>` : empty('Belum pernah skrining.')}</div>`;
}

function vPasien() {
  const p = S.profile, b = bmi(p.bb, p.tb), gs = gulaSince(30), tds = [...S.td].sort((a, b) => new Date(a.t) - new Date(b.t)).filter(x => new Date(x.t).getTime() >= daysAgo(29).getTime());
  const lastG = sortedGula().slice(-1)[0], lastT = [...S.td].sort((a, b) => new Date(a.t) - new Date(b.t)).slice(-1)[0];
  const ad = adherence(7);
  const tile = (ico, l, v, u = '') => `<div><span style="color:var(--pine)">${I(ico)}</span><b>${v}${u ? `<small style="display:inline;font-size:.7rem;margin-left:3px">${u}</small>` : ''}</b><small>${l}</small></div>`;
  const tdList = [...S.td].sort((a, b) => new Date(b.t) - new Date(a.t)).slice(0, 5);
  return `${top('Kondisi pasien', 'Data vital Anda terkumpul di satu tempat.')}
  <div class="panel sage" style="display:flex;gap:14px;align-items:center">
    <div style="width:60px;height:60px;border-radius:50%;background:var(--pine);color:#fff;display:grid;place-items:center;font-size:1.6rem;font-weight:800;flex:none">${esc((p.nama || '?').trim().charAt(0).toUpperCase())}</div>
    <div style="flex:1;min-width:0"><b style="font-size:1.15rem">${esc(p.nama || 'Belum diisi')}</b><p class="note" style="margin-top:0">${p.usia ? esc(p.usia) + ' tahun' : 'Usia –'} · ${JK[p.jk] || 'Jenis kelamin –'}</p>
    <p class="note" style="margin-top:0">BB ${p.bb ? fmt(num(p.bb), 1) + ' kg' : '–'} · TB ${p.tb ? fmt(num(p.tb)) + ' cm' : '–'}${b ? ` · IMT ${fmt(b.v, 1)} (${b.t.toLowerCase()})` : ''}</p></div>
    <a class="btn sm" href="#/profil" style="min-height:40px">Ubah</a></div>
  <div class="sec"><h2 class="sec-title">Data yang dipantau</h2>
    <div class="stats">
      ${tile('drop', 'Gula darah', lastG ? lastG.v : '–', 'mg/dL')}
      ${tile('pulse', 'Tekanan darah', lastT ? `${lastT.sis}/${lastT.dia}` : '–')}
      ${tile('scale', 'Berat badan', p.bb ? fmt(num(p.bb), 1) : '–', 'kg')}
      ${tile('flame', 'Langkah hari ini', fmt(stepsOn(dKey())))}
      ${tile('pill', 'Kepatuhan obat', ad == null ? '–' : ad + '%')}
      ${tile('foot', 'Lingkar perut', p.perut ? fmt(num(p.perut)) : '–', 'cm')}
    </div></div>
  <div class="sec"><h2 class="sec-title">Gula darah (GDS/GDP), 30 hari</h2>${lineChart({ series: [{ pts: gs.map(g => ({ t: new Date(g.t).getTime(), v: g.v, c: COL[klasGula(g.v, g.tipe).c] })), color: '#12372A' }], bands: [{ from: 70, to: 140, color: 'rgba(46,158,91,.13)' }], yMin: 40, label: 'Grafik gula darah' })}</div>
  <div class="sec"><h2 class="sec-title">Tekanan darah, 30 hari</h2>${lineChart({ series: [{ name: 'Sistolik', color: '#12372A', pts: tds.map(x => ({ t: new Date(x.t).getTime(), v: x.sis })) }, { name: 'Diastolik', color: '#E8710A', pts: tds.map(x => ({ t: new Date(x.t).getTime(), v: x.dia })) }], bands: [{ from: 90, to: 130, color: 'rgba(46,158,91,.10)' }], yMin: 40, label: 'Grafik tekanan darah' })}</div>
  <div class="sec" id="form-td"><h2 class="sec-title">Catat tekanan darah</h2>
  <form class="panel" data-form="td" autocomplete="off" style="margin-top:0">
    <div class="three-col"><label class="fld" style="margin:0"><span>Sistolik</span><input name="sis" type="number" inputmode="numeric" min="50" max="260" required placeholder="120"></label>
    <label class="fld" style="margin:0"><span>Diastolik</span><input name="dia" type="number" inputmode="numeric" min="30" max="160" required placeholder="80"></label>
    <label class="fld" style="margin:0"><span>Nadi</span><input name="nadi" type="number" inputmode="numeric" min="30" max="220" placeholder="opsional"></label></div>
    <div class="two"><label class="fld"><span>Berat badan (kg)</span><input name="bb" type="number" inputmode="decimal" step="0.1" min="10" max="300" placeholder="opsional"></label>
    <label class="fld"><span>Waktu</span><input type="datetime-local" name="t" value="${toLocalInput()}" required></label></div>
    <button class="btn gold" type="submit" style="margin-top:16px">Simpan data vital</button></form>
    ${tdList.length ? `<div class="list" style="margin-top:12px">${tdList.map(x => { const k = klasTD(x.sis, x.dia); return `<div class="row log tone-${k.c}"><span class="val" style="min-width:84px">${x.sis}/${x.dia}</span><span class="tx"><b style="font-weight:700">${chip(k.c, k.t)}</b><small>${fmtTglJam(new Date(x.t))}${x.nadi ? ' · nadi ' + x.nadi : ''}</small></span>${delBtn('del-td', x.id)}</div>`; }).join('')}</div>` : ''}</div>
  ${(S.catatan || []).length ? `<div class="sec"><h2 class="sec-title">Catatan tenaga kesehatan</h2>${[...S.catatan].sort((a, b) => new Date(b.t) - new Date(a.t)).slice(0, 5).map(c => `<div class="panel" style="margin-top:8px"><p style="white-space:pre-wrap">${esc(c.isi)}</p><p class="note">${esc(c.staf)} · ${fmtTgl(new Date(c.t))}</p></div>`).join('')}</div>` : ''}
  <p class="tagline">Data Anda adalah kesehatan Anda.</p>`;
}

function periodStats(days) {
  const g = gulaSince(days), vals = g.map(x => x.v), normal = g.filter(x => klasGula(x.v, x.tipe).c === 'ok').length;
  const from = daysAgo(days - 1).getTime(), td = S.td.filter(x => new Date(x.t).getTime() >= from);
  const sk = [], kc = [];
  for (let i = 0; i < days; i++) { const k = dKey(daysAgo(i)); if (S.langkah[k]) sk.push(S.langkah[k]); const m = mealTotals(k); if (m.n) kc.push(m.kcal); }
  let akt = 0; for (let i = 0; i < days; i++) akt += sum(aktOn(dKey(daysAgo(i))).map(a => a.menit));
  return {
    gula: { n: vals.length, avg: avg(vals), min: vals.length ? Math.min(...vals) : null, max: vals.length ? Math.max(...vals) : null, pct: vals.length ? Math.round(normal / vals.length * 100) : null },
    td: { n: td.length, sis: avg(td.map(x => x.sis)), dia: avg(td.map(x => x.dia)) },
    obat: adherence(days), langkah: avg(sk), kkal: avg(kc), akt
  };
}
function ringkasanTeks(days) {
  const s = periodStats(days), p = S.profile;
  const L = [`Ringkasan SIGAP-DM${p.nama ? ' – ' + p.nama : ''} (${days} hari terakhir, per ${fmtTgl(new Date())})`];
  L.push(s.gula.n ? `Gula darah: rata-rata ${fmt(s.gula.avg)} mg/dL (terendah ${s.gula.min}, tertinggi ${s.gula.max}), ${s.gula.pct}% dalam rentang normal, ${s.gula.n} pengukuran.` : 'Gula darah: belum ada catatan.');
  if (s.td.n) L.push(`Tekanan darah: rata-rata ${fmt(s.td.sis)}/${fmt(s.td.dia)} mmHg (${s.td.n} pengukuran).`);
  if (s.obat != null) L.push(`Kepatuhan obat: ${s.obat}%.`);
  if (s.langkah != null) L.push(`Langkah: rata-rata ${fmt(s.langkah)} per hari.`);
  if (s.kkal != null) L.push(`Asupan: rata-rata ${fmt(s.kkal)} kkal per hari.`);
  L.push(`Aktivitas: ${fmt(s.akt)} menit latihan.`);
  return L.join('\n');
}
function vLaporan() {
  const d = UI.period, s = periodStats(d);
  const gs = gulaSince(d), from = daysAgo(d - 1).getTime(), tds = [...S.td].sort((a, b) => new Date(a.t) - new Date(b.t)).filter(x => new Date(x.t).getTime() >= from);
  return `${top('Laporan dan grafik tren', 'Ringkasan untuk Anda, keluarga, dan tenaga kesehatan.')}
  <fieldset class="seg no-print" style="margin-top:0"><legend style="position:absolute;left:-9999px">Periode</legend>
    ${[7, 14, 30, 90].map(n => `<button type="button" class="btn sm ${n === d ? 'pine' : ''}" data-act="period" data-d="${n}" aria-pressed="${n === d}">${n} hari</button>`).join('')}</fieldset>
  <div class="sec" style="margin-top:16px"><h2 class="sec-title">Gula darah</h2>
    <div class="stats"><div><b>${fmt(s.gula.avg)}</b><small>rata-rata mg/dL</small></div><div><b>${fmt(s.gula.min)}–${fmt(s.gula.max)}</b><small>terendah–tertinggi</small></div><div><b>${s.gula.pct == null ? '–' : s.gula.pct + '%'}</b><small>rentang normal</small></div></div>
    ${lineChart({ series: [{ pts: gs.map(g => ({ t: new Date(g.t).getTime(), v: g.v, c: COL[klasGula(g.v, g.tipe).c] })), color: '#12372A' }], bands: [{ from: 70, to: 140, color: 'rgba(46,158,91,.13)' }], yMin: 40, label: 'Grafik gula darah' })}</div>
  <div class="sec"><h2 class="sec-title">Tekanan darah</h2>
    <div class="stats two-c"><div><b>${s.td.n ? fmt(s.td.sis) + '/' + fmt(s.td.dia) : '–'}</b><small>rata-rata mmHg</small></div><div><b>${s.td.n}</b><small>pengukuran</small></div></div>
    ${lineChart({ series: [{ name: 'Sistolik', color: '#12372A', pts: tds.map(x => ({ t: new Date(x.t).getTime(), v: x.sis })) }, { name: 'Diastolik', color: '#E8710A', pts: tds.map(x => ({ t: new Date(x.t).getTime(), v: x.dia })) }], yMin: 40, label: 'Grafik tekanan darah' })}</div>
  <div class="sec"><h2 class="sec-title">Gaya hidup dan obat</h2>
    <div class="stats"><div><b>${s.obat == null ? '–' : s.obat + '%'}</b><small>kepatuhan obat</small></div><div><b>${fmt(s.langkah)}</b><small>langkah/hari</small></div><div><b>${fmt(s.kkal)}</b><small>kkal/hari</small></div></div>
    <p class="note">Rata-rata langkah dan kalori dihitung dari hari yang diisi. Latihan: ${fmt(s.akt)} menit pada periode ini.</p></div>
  <div class="sec no-print"><h2 class="sec-title">Bagikan dan simpan</h2>
    <div class="btn-row"><button class="btn" data-act="share-wa" data-who="keluarga">${I('share')}Ke keluarga</button><button class="btn" data-act="share-wa" data-who="medis">${I('share')}Ke tenaga medis</button></div>
    <div class="btn-row"><button class="btn" data-act="print">${I('print')}Cetak / PDF</button><button class="btn" data-act="csv">${I('download')}Unduh CSV</button></div>
    <p class="note">Nomor WhatsApp keluarga diatur di Profil. Jika kosong, Anda memilih kontak sendiri di WhatsApp. Aplikasi tidak mengirim data apa pun ke server.</p></div>
  <div class="sec"><h2 class="sec-title">Riwayat lengkap</h2>${evRows(events(40))}</div>`;
}

function vBelajar() {
  const rs = UI.kuisRes; UI.kuisRes = null;
  const hist = [...S.kuis].sort((a, b) => new Date(b.t) - new Date(a.t)).slice(0, 5);
  return `${top('Edukasi mandiri', 'Pengetahuan yang baik membantu Anda mengendalikan diabetes.')}
  ${EDU.map(e => `<details><summary><span>${esc(e.t)}</span>${I('chev')}</summary><div class="body">${e.h}</div></details>`).join('')}
  <div class="sec"><h2 class="sec-title">Kuis singkat</h2>
  ${rs ? `<div class="panel sage"><b style="font-size:1.15rem">Skor Anda ${rs.skor} dari ${rs.total}</b><p class="note" style="margin-top:4px">${rs.skor === rs.total ? 'Sempurna!' : 'Baca kembali materi di atas, lalu coba lagi.'}</p>${rs.salah.length ? `<ul style="margin:8px 0 0;padding-left:18px;font-size:.9rem">${rs.salah.map(i => `<li>${esc(QUIZ[i].q)} <b>${esc(QUIZ[i].o[QUIZ[i].a])}</b></li>`).join('')}</ul>` : ''}</div>` : ''}
  <form class="panel" data-form="kuis">${QUIZ.map((q, i) => `<div class="q" ${i === 0 ? 'style="margin-top:0"' : ''}><p>${i + 1}. ${esc(q.q)}</p><fieldset class="seg" style="margin-top:0">${q.o.map((o, j) => `<label><input type="radio" name="q${i}" value="${j}" ${j === 0 ? 'required' : ''}><span>${esc(o)}</span></label>`).join('')}</fieldset></div>`).join('')}
    <button class="btn gold" type="submit" style="margin-top:18px">Periksa jawaban</button></form>
  ${hist.length ? `<p class="note">Skor sebelumnya: ${hist.map(h => `${h.skor}/${h.total} (${fmtTgl(new Date(h.t))})`).join(', ')}</p>` : ''}</div>`;
}

function vProfil() {
  const p = S.profile;
  const f = (l, n, extra = '') => `<label class="fld"><span>${l}</span><input name="${n}" value="${esc(p[n])}" ${extra}></label>`;
  return `${top('Profil dan pengaturan', 'Data ini hanya tersimpan di perangkat Anda.')}
  <form class="panel" data-form="profil" autocomplete="off">
    ${f('Nama panggilan', 'nama', 'maxlength="40"')}
    <div class="two">${f('Usia (tahun)', 'usia', 'type="number" inputmode="numeric" min="1" max="120"')}
    <label class="fld"><span>Jenis kelamin</span><select name="jk"><option value="">Pilih</option><option value="L" ${p.jk === 'L' ? 'selected' : ''}>Laki-laki</option><option value="P" ${p.jk === 'P' ? 'selected' : ''}>Perempuan</option></select></label></div>
    <div class="three-col">${['bb:Berat (kg)', 'tb:Tinggi (cm)', 'perut:Perut (cm)'].map(x => { const [n, l] = x.split(':'); return `<label class="fld" style="margin-top:14px"><span>${l}</span><input name="${n}" type="number" inputmode="decimal" step="0.1" value="${esc(p[n])}"></label>`; }).join('')}</div>
    ${f('Puskesmas / fasilitas kesehatan', 'faskes', 'maxlength="60"')}
    ${f('Kode responden (untuk penelitian, opsional)', 'kode', 'maxlength="20" placeholder="mis. R-001"')}
    <p class="grp-title">Target harian</p>
    <div class="three-col">${['targetKalori:Kalori (kkal)', 'targetLangkah:Langkah', 'targetMenit:Latihan (mnt)'].map(x => { const [n, l] = x.split(':'); return `<label class="fld" style="margin-top:6px"><span>${l}</span><input name="${n}" type="number" inputmode="numeric" min="0" value="${esc(p[n])}"></label>`; }).join('')}</div>
    <p class="grp-title">Kontak WhatsApp (opsional)</p>
    ${f('Ahli gizi', 'waGizi', 'type="tel" inputmode="tel" placeholder="08xxxxxxxxxx"')}
    ${f('Keluarga / pendamping', 'waKeluarga', 'type="tel" inputmode="tel" placeholder="08xxxxxxxxxx"')}
    <button class="btn gold" type="submit" style="margin-top:18px">Simpan profil</button>
  </form>
  <div class="sec"><h2 class="sec-title">Akun dan rekam medis online</h2>
    <div class="panel sage" style="margin-top:0"><p id="sync-status" style="font-size:.92rem" aria-live="polite">${syncStatusHtml()}</p></div>
    ${!syncAvail() ? '' : syncOn() ? `
    <div class="panel"><p class="note" style="margin-top:0">ID pasien Anda</p><b style="font-size:1.6rem;letter-spacing:.06em">${esc(S.profile.pid)}</b>
      <p class="note">Catat ID ini dan PIN Anda. Keduanya dipakai untuk masuk dari HP atau laptop lain.</p></div>
    <div class="btn-row"><button class="btn" data-act="sync-now">Kirim sekarang</button><button class="btn" data-act="sync-pull">Muat dari server</button></div>
    <div class="btn-row"><button class="btn" data-act="sync-all">Kirim ulang semua</button><button class="btn" data-act="sync-stop">Hentikan pengiriman</button></div>
    <button class="btn danger" data-act="logout" style="margin-top:12px">Keluar dari akun</button>` : `
    <form class="panel" data-form="akun" autocomplete="off">
      <label class="check" style="border-top:0;padding-top:0"><input type="checkbox" name="consent"><span>Saya bersedia catatan kesehatan saya, termasuk nama, dikirim ke peneliti dan disimpan di akun saya. Bisa dihentikan kapan saja.</span></label>
      <label class="fld"><span>Buat PIN (6 angka)</span><input name="pin" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password" required></label>
      <button class="btn gold" type="submit" style="margin-top:14px">Buat akun dan kirim data</button></form>
    <button class="btn" data-act="login-profil" style="margin-top:12px">Sudah punya akun? Masuk</button>`}
    <p class="note">Data tetap tersimpan di HP dan dikirim ke server. Jika tidak ada internet, data menunggu dan terkirim otomatis saat tersambung.</p></div>
  <div class="sec"><h2 class="sec-title">Data</h2>
    <div class="btn-row"><button class="btn" data-act="backup">${I('download')}Cadangkan</button><label class="btn" style="cursor:pointer">${I('share')}Pulihkan<input type="file" id="restore-file" accept="application/json,.json" hidden></label></div>
    <p class="note">Data hanya ada di browser ini. Jika Anda ganti HP atau menghapus data browser, data hilang kecuali sudah dicadangkan. Cadangkan secara berkala.</p>
    <button class="btn danger" data-act="reset" style="margin-top:12px">${I('trash')}Hapus semua data</button></div>
  <div class="sec"><h2 class="sec-title">Tentang</h2><p class="note" style="margin-top:0">SIGAP-DM v1.0 · Sistem Informasi Gula Darah Prima untuk diabetes melitus. Dikembangkan untuk keperluan penelitian tesis. Aplikasi ini alat bantu pencatatan dan edukasi, bukan pengganti pemeriksaan, diagnosis, atau saran dokter. Dalam keadaan darurat, segera ke fasilitas kesehatan terdekat.</p></div>`;
}

/* =====================  Router  ===================== */
const ROUTES = {
  '#/mulai': { v: vOnboard, nav: null }, '#/beranda': { v: vHome, nav: '#/beranda' },
  '#/gula': { v: vGula, nav: '#/pasien' }, '#/obat': { v: vObat, nav: '#/beranda' }, '#/makan': { v: vMakan, nav: '#/beranda' },
  '#/aktivitas': { v: vAktivitas, nav: '#/beranda' }, '#/skrining': { v: vSkrining, nav: '#/beranda' },
  '#/pasien': { v: vPasien, nav: '#/pasien' }, '#/laporan': { v: vLaporan, nav: '#/laporan' },
  '#/belajar': { v: vBelajar, nav: '#/belajar' }, '#/profil': { v: vProfil, nav: '#/profil' }
};
const NAV = [['#/beranda', 'home', 'Beranda'], ['#/pasien', 'pasien', 'Pasien'], ['#/laporan', 'data', 'Data'], ['#/belajar', 'book', 'Belajar'], ['#/profil', 'user', 'Profil']];
function render(keepScroll) {
  let h = location.hash || '#/beranda';
  if (!S.profile.onboarded && h !== '#/mulai') { location.replace('#/mulai'); return; }
  if (!ROUTES[h]) h = '#/beranda';
  const r = ROUTES[h], y = window.scrollY;
  document.body.classList.toggle('no-nav', h === '#/mulai');
  $('#view').innerHTML = r.v();
  $$('.nav a').forEach(a => a.setAttribute('aria-current', a.getAttribute('href') === r.nav ? 'page' : 'false'));
  bindMounted();
  if (UI.focus) { const el = document.getElementById(UI.focus); UI.focus = null; if (el) { el.scrollIntoView(); return; } }
  window.scrollTo(0, keepScroll ? y : 0);
}
function bindMounted() {
  const mk = $('#form-makan');
  if (mk) {
    const nm = mk.elements.nama, info = $('#porsi-info');
    const fill = () => {
      const f = FOODS.find(x => x[0].toLowerCase() === nm.value.trim().toLowerCase());
      if (f) { mk.elements.karbo.value = f[2]; mk.elements.protein.value = f[3]; mk.elements.lemak.value = f[4]; info.textContent = `(1 porsi = ${f[1]})`; }
      else info.textContent = '';
    };
    nm.addEventListener('input', fill); nm.addEventListener('change', fill);
  }
  const rf = $('#restore-file');
  if (rf) rf.addEventListener('change', () => {
    const file = rf.files[0]; if (!file) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const o = JSON.parse(rd.result);
        if (!o || typeof o !== 'object' || !Array.isArray(o.gula) || !o.profile) throw new Error('format');
        if (!confirm('Pulihkan data dari file ini? Data yang ada sekarang akan diganti.')) return;
        const d = DEFAULT();
        S = { ...d, ...o, profile: { ...d.profile, ...o.profile, onboarded: true }, settings: { ...d.settings, ...(o.settings || {}) } };
        save(); if (syncOn()) enqueueAll(); toast('Data berhasil dipulihkan.'); render();
      } catch (e) { toast('File cadangan tidak valid.'); }
    };
    rd.readAsText(file);
  });
}

/* =====================  Aksi klik  ===================== */
function csvEsc(v) { v = String(v ?? ''); return /[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function buildCSV() {
  const k = S.profile.kode || '';
  const rows = [['kode_responden', 'jenis', 'waktu', 'nilai', 'satuan', 'keterangan']];
  S.gula.forEach(x => rows.push([k, 'gula_darah', x.t, x.v, 'mg/dL', `${TIPE[x.tipe]}; ${klasGula(x.v, x.tipe).t}${x.cat ? '; ' + x.cat : ''}`]));
  S.td.forEach(x => rows.push([k, 'tekanan_darah', x.t, `${x.sis}/${x.dia}`, 'mmHg', x.nadi ? 'nadi ' + x.nadi : '']));
  S.makan.forEach(x => rows.push([k, 'makan', x.t, Math.round(kcalOf(x)), 'kkal', `${x.waktu}; ${x.nama}; karbo ${x.karbo} g; protein ${x.protein} g; lemak ${x.lemak} g`]));
  S.aktivitas.forEach(x => rows.push([k, 'aktivitas', x.t, x.menit, 'menit', `${x.jenis}; ${Math.round(x.kcal)} kkal`]));
  Object.keys(S.langkah).sort().forEach(d => rows.push([k, 'langkah', d, S.langkah[d], 'langkah', '']));
  S.obatLog.forEach(x => { const o = S.obat.find(m => m.id === x.obatId); rows.push([k, 'minum_obat', x.t, 1, 'dosis', `${o ? o.nama : ''}; jadwal ${x.jam}`]); });
  S.skrining.forEach(x => rows.push([k, 'skrining_risiko', x.t, x.skor, 'skor', 'Berisiko ' + x.kat]));
  S.kuis.forEach(x => rows.push([k, 'kuis_edukasi', x.t, x.skor, `dari ${x.total}`, '']));
  return '\ufeff' + rows.map(r => r.map(csvEsc).join(',')).join('\r\n');
}
const waNum = s => { let d = String(s || '').replace(/\D/g, ''); if (d.startsWith('0')) d = '62' + d.slice(1); else if (d.startsWith('8')) d = '62' + d; return d; };
const waOpen = (num, text) => window.open(`https://wa.me/${waNum(num)}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
const toggleRemove = (arr, id) => { const i = arr.findIndex(x => x.id === id); if (i >= 0) arr.splice(i, 1); };
const confirmDel = () => confirm('Hapus catatan ini?');

const ACT = {
  sheet() { $('#sheet').classList.add('open'); $('#sheet .sh button')?.focus(); },
  'sheet-close'() { $('#sheet').classList.remove('open'); },
  goto(b) {
    $('#sheet').classList.remove('open');
    UI.focus = b.dataset.focus || null;
    if (location.hash === b.dataset.href) render(); else location.hash = b.dataset.href;
  },
  start() { UI.step = 2; render(); },
  'del-gula'(b) { if (confirmDel()) { toggleRemove(S.gula, b.dataset.id); save(); qdel('gula', b.dataset.id); render(true); } },
  'del-td'(b) { if (confirmDel()) { toggleRemove(S.td, b.dataset.id); save(); qdel('td', b.dataset.id); render(true); } },
  'del-makan'(b) { if (confirmDel()) { toggleRemove(S.makan, b.dataset.id); save(); qdel('makan', b.dataset.id); render(true); } },
  'del-obat'(b) {
    if (!confirm('Hapus obat ini beserta jadwalnya?')) return;
    const id = b.dataset.id, gone = S.obatLog.filter(l => l.obatId === id);
    toggleRemove(S.obat, id); S.obatLog = S.obatLog.filter(l => l.obatId !== id); save();
    qdel('obat', id); gone.forEach(l => qdel('minumobat', l.id)); render(true);
  },
  'toggle-obat'(b) { const o = S.obat.find(x => x.id === b.dataset.id); if (o) { o.aktif = !o.aktif; save(); qrec('obat', o); render(true); } },
  take(b) {
    const { obat, jam } = b.dataset, tgl = dKey(), ex = doseLog(obat, tgl, jam);
    if (ex) { S.obatLog.splice(S.obatLog.indexOf(ex), 1); qdel('minumobat', ex.id); }
    else { const rec = { id: uid(), obatId: obat, tgl, jam, t: new Date().toISOString() }; S.obatLog.push(rec); qrec('minumobat', rec); toast('Dosis dicatat. Terima kasih!'); }
    save(); render(true);
  },
  'add-jam'() {
    const w = $('#jam-wrap'), n = $$('input', w).length;
    if (n >= 4) return toast('Maksimal 4 jam per obat.');
    const i = document.createElement('input'); i.type = 'time'; i.name = 'jam'; i.required = true; i.setAttribute('aria-label', `Jam minum ${n + 1}`);
    w.appendChild(i); i.focus();
  },
  notif() {
    if (!('Notification' in window)) return toast('Browser ini tidak mendukung notifikasi.');
    if (S.settings.notif && Notification.permission === 'granted') { S.settings.notif = false; save(); toast('Pengingat dimatikan.'); return render(true); }
    Notification.requestPermission().then(r => {
      if (r === 'granted') { S.settings.notif = true; save(); toast('Pengingat aktif.'); checkReminders(); }
      else toast('Izin notifikasi ditolak. Aktifkan lewat pengaturan browser.');
      render(true);
    });
  },
  'quick-akt'(b) { addAkt(b.dataset.jenis, num(b.dataset.menit)); },
  'wa-gizi'() {
    if (!S.profile.waGizi) { toast('Isi nomor WhatsApp ahli gizi di menu Profil.'); return; }
    const t = new Date(), m = mealTotals(dKey());
    waOpen(S.profile.waGizi, `Halo, saya ${S.profile.nama || 'pengguna SIGAP-DM'}. Saya ingin berkonsultasi tentang pola makan. Asupan hari ini sekitar ${fmt(m.kcal)} kkal (karbo ${fmt(m.k)} g, protein ${fmt(m.p)} g, lemak ${fmt(m.f)} g).`);
  },
  'to-login'() { UI.step = 'login'; render(); },
  'to-intro'() { UI.step = 1; render(); },
  'login-profil'() { if (confirm('Masuk ke akun lain akan mengganti data di HP ini dengan data dari akun tersebut. Lanjutkan?')) { UI.step = 'login'; location.hash = '#/mulai'; render(); } },
  'dismiss-id'() { UI.newId = null; render(true); },
  'sync-pull'() { tarik(true); },
  'sync-stop'() {
    if (!confirm('Hentikan pengiriman data ke server? Data di HP tetap ada dan Anda bisa memakai aplikasi seperti biasa.')) return;
    S.settings.sync = false; S.settings.pin = ''; S.queue = []; save(); toast('Pengiriman dihentikan.'); render(true);
  },
  logout() {
    if (!confirm('Keluar dari akun? Data di HP ini akan dihapus. Data di server tetap ada dan bisa dimuat lagi dengan ID dan PIN.')) return;
    localStorage.removeItem(KEY); S = DEFAULT(); UI.step = 1; location.hash = '#/mulai'; render();
  },
  'sync-now'() { flush(true); },
  'sync-all'() { if (syncOn() && confirm('Kirim ulang seluruh data di HP ini ke spreadsheet? Data yang sama akan diperbarui, bukan digandakan.')) enqueueAll(); },
  period(b) { UI.period = Number(b.dataset.d); render(true); },
  'share-wa'(b) {
    const txt = ringkasanTeks(UI.period), no = b.dataset.who === 'keluarga' ? S.profile.waKeluarga : '';
    waOpen(no, txt);
  },
  print() { window.print(); },
  csv() { download(`sigap-dm-${S.profile.kode || 'data'}-${dKey()}.csv`, buildCSV(), 'text/csv;charset=utf-8'); toast('File CSV diunduh.'); },
  backup() { const c = JSON.parse(JSON.stringify(S)); delete c.queue; if (c.settings) delete c.settings.pin; download(`sigap-dm-cadangan-${dKey()}.json`, JSON.stringify(c, null, 2), 'application/json'); toast('Cadangan diunduh.'); },
  reset() {
    if (!confirm('Hapus SEMUA data di aplikasi ini? Tindakan ini tidak dapat dibatalkan.')) return;
    if (!confirm('Yakin? Pastikan Anda sudah mencadangkan data.')) return;
    localStorage.removeItem(KEY); S = DEFAULT(); UI.step = 1; location.hash = '#/mulai'; render();
  }
};
function addAkt(jenis, menit) {
  if (!menit || menit < 1) return toast('Isi lama latihan.');
  const bb = num(S.profile.bb) || 60, kcal = (MET[jenis] || 3) * bb * menit / 60;
  const rec = { id: uid(), t: new Date().toISOString(), jenis, menit, kcal: Math.round(kcal) };
  S.aktivitas.push(rec); save(); qrec('aktivitas', rec); toast(`${jenis} ${menit} menit tercatat (±${Math.round(kcal)} kkal).`); render(true);
}

/* =====================  Formulir  ===================== */
const FORM = {
  async onboard(f) {
    const e = f.elements, c = !!(e.consent && e.consent.checked), pin = e.pin ? e.pin.value : '';
    if (c && syncAvail() && !/^\d{6}$/.test(pin)) return toast('PIN harus 6 angka.');
    Object.assign(S.profile, { nama: e.nama.value.trim(), usia: e.usia.value, jk: e.jk.value, bb: e.bb.value, tb: e.tb.value, faskes: e.faskes.value.trim() });
    if (c && syncAvail()) { toast('Membuat akun...'); if (!await daftarAkun(pin)) return; }
    S.profile.onboarded = true; save(); UI.step = 1; location.hash = '#/beranda'; render();
  },
  async masuk(f) {
    const pid = f.elements.pid.value.trim().toUpperCase(), pin = f.elements.pin.value;
    if (!/^P-[A-Z0-9]{6}$/.test(pid)) return toast('Format ID: P- diikuti 6 huruf/angka.');
    if (!/^\d{6}$/.test(pin)) return toast('PIN harus 6 angka.');
    if (!navigator.onLine) return toast('Perlu internet untuk masuk.');
    toast('Memuat data...');
    try {
      const j = await post({ aksi: 'masuk', pid, pin });
      if (!j.ok) return toast(j.error || 'Gagal masuk.');
      S = DEFAULT(); S.profile.pid = pid; S.settings.sync = true; S.settings.pin = pin;
      mergeServer(j.data); S.profile.onboarded = true; save(); UI.step = 1; lastPullAt = Date.now();
      toast('Berhasil masuk. Data dimuat dari server.'); location.hash = '#/beranda'; render();
    } catch (err) { toast('Gagal terhubung ke server. Periksa internet.'); }
  },
  async akun(f) {
    const e = f.elements;
    if (!e.consent.checked) return toast('Centang persetujuan terlebih dahulu.');
    if (!/^\d{6}$/.test(e.pin.value)) return toast('PIN harus 6 angka.');
    toast('Membuat akun...');
    if (await daftarAkun(e.pin.value)) { toast('Akun dibuat. Catat ID Anda.'); render(); }
  },
  profil(f) {
    const e = f.elements;
    ['nama', 'usia', 'jk', 'bb', 'tb', 'perut', 'faskes', 'kode', 'waGizi', 'waKeluarga', 'targetKalori', 'targetLangkah', 'targetMenit'].forEach(n => { if (e[n]) S.profile[n] = e[n].value.trim(); });
    save(); qpas(); toast('Profil disimpan.');
  },
  gula(f) {
    const e = f.elements, v = num(e.v.value);
    if (v == null || v < 20 || v > 900) return toast('Isi angka gula darah antara 20 dan 900 mg/dL.');
    const t = new Date(e.t.value); if (isNaN(t)) return toast('Waktu tidak valid.');
    const tipe = e.tipe.value, k = klasGula(v, tipe);
    const rec = { id: uid(), t: t.toISOString(), v: Math.round(v), tipe, cat: e.cat.value.trim() };
    S.gula.push(rec); save(); qrec('gula', rec); UI.gulaRes = { v: Math.round(v), ...k }; toast('Catatan disimpan.'); render(true);
  },
  td(f) {
    const e = f.elements, sis = num(e.sis.value), dia = num(e.dia.value);
    if (!sis || !dia || sis <= dia) return toast('Periksa angka: sistolik harus lebih besar dari diastolik.');
    const t = new Date(e.t.value); if (isNaN(t)) return toast('Waktu tidak valid.');
    const rec = { id: uid(), t: t.toISOString(), sis: Math.round(sis), dia: Math.round(dia), nadi: num(e.nadi.value) || null };
    S.td.push(rec);
    const bb = num(e.bb.value); if (bb) S.profile.bb = String(bb);
    save(); qrec('td', rec); if (bb) qpas(); toast('Data vital disimpan.'); render(true);
  },
  obat(f) {
    const e = f.elements;
    const jam = [...new Set($$('input[name=jam]', f).map(i => i.value).filter(Boolean))].sort();
    if (!jam.length) return toast('Isi sedikitnya satu jam minum.');
    const rec = { id: uid(), nama: e.nama.value.trim(), dosis: e.dosis.value.trim(), jam, cat: e.cat.value.trim(), aktif: true, dibuat: dKey() };
    S.obat.push(rec); save(); qrec('obat', rec); toast('Obat disimpan.'); render(true);
  },
  makan(f) {
    const e = f.elements, por = num(e.porsi.value) || 1;
    const m = { id: uid(), t: new Date().toISOString(), waktu: e.waktu.value, nama: e.nama.value.trim(), karbo: (num(e.karbo.value) || 0) * por, protein: (num(e.protein.value) || 0) * por, lemak: (num(e.lemak.value) || 0) * por };
    if (!m.nama) return toast('Isi nama makanan.');
    m.karbo = Math.round(m.karbo * 10) / 10; m.protein = Math.round(m.protein * 10) / 10; m.lemak = Math.round(m.lemak * 10) / 10;
    S.makan.push(m); save(); qrec('makan', m); toast(`${m.nama} tercatat (${fmt(kcalOf(m))} kkal).`); render(true);
  },
  langkah(f) { const n = num(f.elements.n.value); if (n == null || n < 0) return toast('Isi jumlah langkah.'); S.langkah[dKey()] = Math.round(n); save(); qrec('langkah', langkahRec(dKey())); toast('Langkah disimpan.'); render(true); },
  akt(f) { addAkt(f.elements.jenis.value, num(f.elements.menit.value)); },
  skrAkt(f) { $('#akt-saran').innerHTML = saranAktivitas(f); },
  skrining(f) {
    const e = f.elements, a = {
      usia: num(e.usia.value), jk: e.jk.value, bb: num(e.bb.value), tb: num(e.tb.value), perut: num(e.perut.value),
      hip: e.hip.value === '1', aktif: e.aktif.value === '1', sayur: e.sayur.value === '1', pernah: e.pernah.value === '1', kel: Number(e.kel.value)
    };
    if (!a.usia || !a.jk || !a.perut) return toast('Lengkapi usia, jenis kelamin, dan lingkar perut.');
    const r = hitungSkrining(a);
    const rec = { id: uid(), t: new Date().toISOString(), skor: r.skor, kat: r.kat, jawaban: a };
    S.skrining.push(rec);
    Object.assign(S.profile, { usia: String(a.usia), jk: a.jk, bb: String(a.bb), tb: String(a.tb), perut: String(a.perut) });
    save(); qrec('skrining', rec); qpas(); UI.skrRes = r; render(); toast('Hasil skrining disimpan.');
  },
  kuis(f) {
    let skor = 0; const salah = [];
    QUIZ.forEach((q, i) => { if (Number(f.elements['q' + i].value) === q.a) skor++; else salah.push(i); });
    const rec = { id: uid(), t: new Date().toISOString(), skor, total: QUIZ.length };
    S.kuis.push(rec); save(); qrec('kuis', rec); UI.kuisRes = { skor, total: QUIZ.length, salah }; render(true);
    document.querySelector('.panel.sage')?.scrollIntoView({ block: 'center' });
  }
};

/* =====================  Pengingat obat  ===================== */
const notified = new Set();
function checkReminders() {
  if (!S.settings.notif || !('Notification' in window) || Notification.permission !== 'granted') return;
  const now = new Date(), dk = dKey(now), hm = hhmm(now);
  const mins = s => { const [a, b] = s.split(':').map(Number); return a * 60 + b; };
  dosesFor(dk, hm).forEach(({ o, j }) => {
    const key = `${o.id}|${dk}|${j}`;
    if (doseLog(o.id, dk, j) || notified.has(key) || mins(hm) - mins(j) > 30) return;
    notified.add(key);
    const title = 'Saatnya minum obat', opts = { body: `${o.nama} · ${o.dosis} (${j})`, tag: key, icon: 'icons/icon-192.png' };
    if (navigator.serviceWorker && navigator.serviceWorker.ready) navigator.serviceWorker.ready.then(r => r.showNotification(title, opts)).catch(() => { try { new Notification(title, opts); } catch (e) { } });
    else { try { new Notification(title, opts); } catch (e) { } }
  });
}

/* =====================  Inisialisasi  ===================== */
function init() {
  $('.nav').innerHTML = NAV.map(([h, ic, l]) => `<a href="${h}">${I(ic)}<span>${l}</span></a>`).join('');
  $('.fab').innerHTML = I('plus');
  $('#sheet').innerHTML = `<div class="bk" data-act="sheet-close"></div><div class="sh" role="dialog" aria-modal="true" aria-label="Tambah catatan"><h2>Catat sekarang</h2><div class="list">
    <button class="row" style="width:100%;background:none;border:0;border-bottom:1px solid var(--line);text-align:left;cursor:pointer" data-act="goto" data-href="#/gula"><span class="ico">${I('drop')}</span><span class="tx"><b>Gula darah</b></span></button>
    <button class="row" style="width:100%;background:none;border:0;border-bottom:1px solid var(--line);text-align:left;cursor:pointer" data-act="goto" data-href="#/pasien" data-focus="form-td"><span class="ico">${I('pulse')}</span><span class="tx"><b>Tekanan darah</b></span></button>
    <button class="row" style="width:100%;background:none;border:0;border-bottom:1px solid var(--line);text-align:left;cursor:pointer" data-act="goto" data-href="#/makan" data-focus="form-makan"><span class="ico">${I('fork')}</span><span class="tx"><b>Makanan</b></span></button>
    <button class="row" style="width:100%;background:none;border:0;border-bottom:1px solid var(--line);text-align:left;cursor:pointer" data-act="goto" data-href="#/aktivitas"><span class="ico">${I('flame')}</span><span class="tx"><b>Aktivitas fisik</b></span></button>
    <button class="row" style="width:100%;background:none;border:0;border-bottom:1px solid var(--line);text-align:left;cursor:pointer" data-act="goto" data-href="#/obat"><span class="ico">${I('pill')}</span><span class="tx"><b>Minum obat</b></span></button></div>
    <button class="btn" data-act="sheet-close" style="margin-top:12px">Tutup</button></div>`;

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const fn = ACT[b.dataset.act]; if (fn) fn(b, e);
  });
  document.addEventListener('submit', e => {
    const f = e.target.closest('form[data-form]'); if (!f) return;
    e.preventDefault();
    const fn = FORM[f.dataset.form]; if (fn) fn(f, e);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') ACT['sheet-close'](); });
  window.addEventListener('hashchange', () => render());

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => { });
  setInterval(checkReminders, 30000);
  setInterval(() => flush(), 60000);
  window.addEventListener('online', () => { flush(); tarik(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { flush(); tarik(); } });
  render();
  flush().then(() => tarik());
}
document.addEventListener('DOMContentLoaded', init);
})();
