/* SIGAP-DM Dashboard — untuk tenaga kesehatan dan peneliti.
   Membaca data dari server Google Apps Script yang sama dengan aplikasi pasien (js/config.js). */
(() => {
'use strict';
const CFG = window.SIGAP_CONFIG || {};
const SS_KEY = 'sigapdm.staf';
const DAY = 864e5;
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const dKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hhmm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const fmtDT = d => `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}.${pad(d.getMinutes())}`;
const fmtD = d => `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
const fmt = (n, dec = 0) => (n == null || Number.isNaN(n)) ? '–' : Number(n).toLocaleString('id-ID', { maximumFractionDigits: dec });
const sum = a => a.reduce((x, y) => x + y, 0);
const avg = a => a.length ? sum(a) / a.length : null;
const byT = (a, b) => new Date(a.t) - new Date(b.t);
const JK = { L: 'Laki-laki', P: 'Perempuan' };
const TIPE = { GDP: 'Puasa', GDS: 'Sewaktu', '2JPP': '2 jam setelah makan' };
const COL = { low: '#2F6FDE', ok: '#2E9E5B', warn: '#E8710A', high: '#C8372D', crit: '#8E1B16' };

let SES = null;          // { token, nama, peran }
let DB = { pasien: [], data: {} };
let ROWS = [];           // ringkasan per pasien
let sortBy = { k: 'alert', dir: -1 };
let openPid = null;
let toastTimer;

function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2800); }

/* ---------- klasifikasi (sama dengan aplikasi pasien) ---------- */
function klasGula(v, tipe) {
  if (v < 70) return { c: 'low', t: 'Rendah' };
  if (v >= 300) return { c: 'crit', t: 'Sangat tinggi' };
  const warn = tipe === 'GDP' ? 100 : 140, hi = tipe === 'GDP' ? 126 : 200;
  if (v >= hi) return { c: 'high', t: 'Tinggi' };
  if (v >= warn) return { c: 'warn', t: 'Di atas normal' };
  return { c: 'ok', t: 'Normal' };
}
function klasTD(s, d) {
  if (s < 90 || d < 60) return { c: 'low', t: 'Rendah' };
  if (s >= 140 || d >= 90) return { c: 'high', t: 'Tinggi' };
  if (s >= 130 || d >= 80) return { c: 'warn', t: 'Waspada' };
  return { c: 'ok', t: 'Normal' };
}
const chip = (c, t) => `<span class="chip tone-${c}">${esc(t)}</span>`;

/* ---------- API ---------- */
async function api(aksi, body = {}) {
  const res = await fetch(CFG.SYNC_URL, {
    method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ token: CFG.TOKEN || '', aksi, stafToken: SES && SES.token, ...body })
  });
  return res.json();
}

/* ---------- ringkasan per pasien ---------- */
function adherence(d, days) {
  let exp = 0, got = 0;
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const dk = dKey(day);
    (d.obat || []).forEach(o => {
      if (!o.aktif || dk < o.dibuat) return;
      (o.jam || []).forEach(j => {
        if (i === 0 && j > hhmm(now)) return;
        exp++;
        if ((d.minumobat || []).some(l => l.obatId === o.id && l.tgl === dk && l.jam === j)) got++;
      });
    });
  }
  return exp ? Math.round(got / exp * 100) : null;
}
function ringkas(p) {
  const d = DB.data[p.pid] || {}, now = Date.now();
  const gs = (d.gula || []).slice().sort(byT), g7 = gs.filter(x => now - new Date(x.t) <= 7 * DAY);
  const tds = (d.td || []).slice().sort(byT), lastT = tds[tds.length - 1], lastG = gs[gs.length - 1];
  const skr = (d.skrining || []).slice().sort(byT).pop();
  const ad = adherence(d, 7);
  const stp = (d.langkah || []).filter(r => now - new Date(r.tgl + 'T12:00:00') <= 7 * DAY).map(r => r.n);
  const times = [];
  ['gula', 'td', 'makan', 'aktivitas', 'minumobat', 'skrining', 'kuis'].forEach(k => (d[k] || []).forEach(r => times.push(+new Date(r.t))));
  (d.langkah || []).forEach(r => times.push(+new Date(r.tgl + 'T12:00:00')));
  const lastAct = times.length ? Math.max(...times) : null;
  const idle = lastAct == null ? null : Math.floor((now - lastAct) / DAY);
  const avg7 = g7.length ? avg(g7.map(x => x.v)) : null;
  const flags = [];
  if (g7.some(x => x.v < 70)) flags.push({ t: 'Gula rendah', lv: 2, key: 'rendah' });
  if (g7.some(x => x.v >= 300)) flags.push({ t: 'Gula sangat tinggi', lv: 2, key: 'tinggi' });
  if (avg7 != null && avg7 >= 180) flags.push({ t: 'Rata-rata gula tinggi', lv: 1, key: 'avg' });
  if (lastT && klasTD(lastT.sis, lastT.dia).c === 'high') flags.push({ t: 'TD tinggi', lv: 1, key: 'td' });
  if (idle == null) flags.push({ t: 'Belum ada catatan', lv: 1, key: 'idle' });
  else if (idle >= 3) flags.push({ t: `Tidak aktif ${idle} hari`, lv: 1, key: 'idle' });
  if (ad != null && ad < 60) flags.push({ t: 'Kepatuhan obat rendah', lv: 1, key: 'patuh' });
  if (skr && skr.kat === 'Tinggi') flags.push({ t: 'Skrining risiko tinggi', lv: 0, key: 'skr' });
  return {
    pid: p.pid, nama: p.nama || (p.profil && p.profil.nama) || '(tanpa nama)', profil: p.profil || {},
    lastG, avg7, nG7: g7.length, lastT, ad, steps: avg(stp), skr, lastAct, idle, flags,
    alert: sum(flags.map(f => f.lv)), nCat: (d.catatan || []).length
  };
}
function buildRows() { ROWS = DB.pasien.map(ringkas); }

/* ---------- KPI ---------- */
function renderKpis() {
  const from = Date.now() - 14 * DAY, all = [];
  Object.values(DB.data).forEach(d => (d.gula || []).forEach(g => { if (new Date(g.t) >= from) all.push(g); }));
  const norm = all.filter(g => klasGula(g.v, g.tipe).c === 'ok').length;
  const ads = ROWS.map(r => r.ad).filter(x => x != null);
  const perhatian = ROWS.filter(r => r.alert > 0).length;
  const idle = ROWS.filter(r => r.idle == null || r.idle >= 3).length;
  const k = (b, s, bad) => `<div class="kpi ${bad ? 'bad' : ''}"><b>${b}</b><small>${s}</small></div>`;
  $('#kpis').innerHTML = k(ROWS.length, 'pasien terdaftar') + k(perhatian, 'perlu perhatian', perhatian > 0) +
    k(idle, 'tidak aktif ≥ 3 hari', idle > 0) + k(all.length ? fmt(avg(all.map(g => g.v))) : '–', 'rata-rata gula 14 hari (mg/dL)') +
    k(all.length ? Math.round(norm / all.length * 100) + '%' : '–', 'pengukuran normal 14 hari') + k(ads.length ? Math.round(avg(ads)) + '%' : '–', 'rata-rata kepatuhan obat');
}

/* ---------- tabel ---------- */
const COLS = [
  { k: 'nama', t: 'Pasien', v: r => r.nama.toLowerCase() },
  { k: 'usia', t: 'Usia/JK', v: r => Number(r.profil.usia) || 0 },
  { k: 'gula', t: 'Gula terakhir', v: r => r.lastG ? new Date(r.lastG.t).getTime() : 0 },
  { k: 'avg7', t: 'Rata-rata 7 hari', v: r => r.avg7 ?? -1 },
  { k: 'td', t: 'TD terakhir', v: r => r.lastT ? r.lastT.sis : -1 },
  { k: 'ad', t: 'Kepatuhan obat', v: r => r.ad ?? -1 },
  { k: 'steps', t: 'Langkah/hari', v: r => r.steps ?? -1 },
  { k: 'skr', t: 'Skrining', v: r => r.skr ? r.skr.skor : -1 },
  { k: 'act', t: 'Aktivitas terakhir', v: r => r.lastAct ?? 0 },
  { k: 'alert', t: 'Peringatan', v: r => r.alert }
];
function renderHead() {
  $('#thead').innerHTML = COLS.map(c => `<th scope="col" data-k="${c.k}" tabindex="0" aria-sort="${sortBy.k === c.k ? (sortBy.dir > 0 ? 'ascending' : 'descending') : 'none'}">${c.t}</th>`).join('');
}
function filtered() {
  const q = $('#q').value.trim().toLowerCase(), f = $('#flt').value;
  return ROWS.filter(r => {
    if (q && !(r.nama.toLowerCase().includes(q) || r.pid.toLowerCase().includes(q))) return false;
    if (f === 'alert') return r.alert > 0;
    if (f === 'rendah' || f === 'tinggi' || f === 'idle' || f === 'patuh') return r.flags.some(x => x.key === f);
    return true;
  });
}
function renderTable() {
  const col = COLS.find(c => c.k === sortBy.k) || COLS[0];
  const rows = filtered().sort((a, b) => { const x = col.v(a), y = col.v(b); return (x < y ? -1 : x > y ? 1 : 0) * sortBy.dir || a.nama.localeCompare(b.nama); });
  $('#count').textContent = `${rows.length} dari ${ROWS.length} pasien`;
  $('#empty').hidden = rows.length > 0;
  $('#empty').textContent = ROWS.length ? 'Tidak ada pasien yang cocok dengan pencarian atau filter.' : 'Belum ada pasien terdaftar. Data muncul setelah responden membuat akun di aplikasi.';
  $('#tbody').innerHTML = rows.map(r => {
    const g = r.lastG ? klasGula(r.lastG.v, r.lastG.tipe) : null, t = r.lastT ? klasTD(r.lastT.sis, r.lastT.dia) : null;
    return `<tr>
      <td><button class="namebtn" data-pid="${esc(r.pid)}">${esc(r.nama)}</button><small>${esc(r.pid)}</small></td>
      <td>${r.profil.usia ? esc(r.profil.usia) + ' th' : '–'}<small>${JK[r.profil.jk] || ''}</small></td>
      <td>${g ? `<span class="num">${r.lastG.v}</span> ${chip(g.c, g.t)}<small>${TIPE[r.lastG.tipe]} · ${fmtDT(new Date(r.lastG.t))}</small>` : '–'}</td>
      <td>${r.avg7 != null ? `<span class="num">${fmt(r.avg7)}</span><small>${r.nG7} pengukuran</small>` : '–'}</td>
      <td>${r.lastT ? `<span class="num">${r.lastT.sis}/${r.lastT.dia}</span> ${chip(t.c, t.t)}` : '–'}</td>
      <td>${r.ad != null ? `<span class="num">${r.ad}%</span>` : '–'}</td>
      <td>${r.steps != null ? fmt(r.steps) : '–'}</td>
      <td>${r.skr ? `<span class="num">${r.skr.skor}</span><small>${esc(r.skr.kat)}</small>` : '–'}</td>
      <td>${r.lastAct ? fmtD(new Date(r.lastAct)) : '–'}<small>${r.idle == null ? '' : r.idle === 0 ? 'hari ini' : r.idle + ' hari lalu'}</small></td>
      <td>${r.flags.length ? `<div class="flags">${r.flags.map(f => `<span class="flag l${f.lv}">${esc(f.t)}</span>`).join('')}</div>` : '<span class="ok-txt">Baik</span>'}</td></tr>`;
  }).join('');
}

/* ---------- grafik ---------- */
function lineChart(o) {
  const all = o.series.flatMap(s => s.pts);
  if (!all.length) return `<div class="chart"><div class="empty-chart">Belum ada data.</div></div>`;
  const W = 680, H = 210, pl = 38, pr = 12, pt = 10, pb = 26;
  let tMin = Math.min(...all.map(p => p.t)), tMax = Math.max(...all.map(p => p.t));
  if (tMax === tMin) { tMin -= 43200000; tMax += 43200000; }
  let vMin = o.yMin ?? Math.floor((Math.min(...all.map(p => p.v)) - 10) / 10) * 10;
  let vMax = Math.ceil((Math.max(...all.map(p => p.v)) + 10) / 10) * 10;
  if (vMax <= vMin) vMax = vMin + 10;
  vMax = vMin + Math.ceil((vMax - vMin) / 40) * 40;
  const x = t => pl + (t - tMin) / (tMax - tMin) * (W - pl - pr), y = v => pt + (1 - (v - vMin) / (vMax - vMin)) * (H - pt - pb);
  let g = '';
  for (let i = 0; i <= 4; i++) { const v = vMin + (vMax - vMin) * i / 4, yy = y(v); g += `<line x1="${pl}" x2="${W - pr}" y1="${yy}" y2="${yy}" stroke="#E4EDE6"/><text x="${pl - 5}" y="${yy + 3}" text-anchor="end">${Math.round(v)}</text>`; }
  (o.bands || []).forEach(b => { const y1 = y(Math.min(b.to, vMax)), y2 = y(Math.max(b.from, vMin)); if (y2 > y1) g = `<rect x="${pl}" y="${y1}" width="${W - pl - pr}" height="${y2 - y1}" fill="${b.color}"/>` + g; });
  let lines = '';
  o.series.forEach(s => {
    if (!s.pts.length) return;
    if (s.pts.length > 1) lines += `<polyline points="${s.pts.map(p => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')}" fill="none" stroke="${s.color}" stroke-width="2.2" stroke-linejoin="round"/>`;
    s.pts.forEach(p => { lines += `<circle cx="${x(p.t).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="3.6" fill="${p.c || s.color}" stroke="#fff" stroke-width="1.2"/>`; });
  });
  const d1 = new Date(tMin + (tMax === tMin ? 0 : 0)), d2 = new Date(Math.max(...all.map(p => p.t)));
  const first = new Date(Math.min(...all.map(p => p.t)));
  const lab = d => `${d.getDate()} ${BULAN[d.getMonth()]}`;
  const xl = `<text x="${pl}" y="${H - 7}">${lab(first)}</text>` + (dKey(first) !== dKey(d2) ? `<text x="${W - pr}" y="${H - 7}" text-anchor="end">${lab(d2)}</text>` : '');
  const lg = o.series.filter(s => s.name).length > 1 ? `<div class="lg">${o.series.map(s => `<span><i style="background:${s.color}"></i>${s.name}</span>`).join('')}</div>` : '';
  void d1;
  return `<div class="chart">${lg}<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label)}">${g}${lines}${xl}</svg></div>`;
}

/* ---------- detail pasien ---------- */
function eventsOf(d) {
  const ev = [];
  (d.gula || []).forEach(x => ev.push({ t: new Date(x.t), j: 'Gula darah', v: `${x.v} mg/dL (${klasGula(x.v, x.tipe).t}) · ${TIPE[x.tipe]}${x.cat ? ' · ' + x.cat : ''}` }));
  (d.td || []).forEach(x => ev.push({ t: new Date(x.t), j: 'Tekanan darah', v: `${x.sis}/${x.dia} mmHg (${klasTD(x.sis, x.dia).t})${x.nadi ? ' · nadi ' + x.nadi : ''}` }));
  (d.makan || []).forEach(x => ev.push({ t: new Date(x.t), j: 'Makan', v: `${x.waktu}: ${x.nama} · K${x.karbo} P${x.protein} L${x.lemak} g` }));
  (d.aktivitas || []).forEach(x => ev.push({ t: new Date(x.t), j: 'Aktivitas', v: `${x.jenis} ${x.menit} menit (±${x.kcal} kkal)` }));
  (d.minumobat || []).forEach(x => { const o = (d.obat || []).find(m => m.id === x.obatId); ev.push({ t: new Date(x.t), j: 'Minum obat', v: `${o ? o.nama : 'obat'} (jadwal ${x.jam})` }); });
  (d.skrining || []).forEach(x => ev.push({ t: new Date(x.t), j: 'Skrining', v: `Skor ${x.skor}, berisiko ${String(x.kat).toLowerCase()}` }));
  (d.kuis || []).forEach(x => ev.push({ t: new Date(x.t), j: 'Kuis edukasi', v: `${x.skor}/${x.total}` }));
  return ev.sort((a, b) => b.t - a.t);
}
function renderDetail() {
  const r = ROWS.find(x => x.pid === openPid); if (!r) return;
  const d = DB.data[r.pid] || {}, p = r.profil, now = Date.now();
  const gs = (d.gula || []).slice().sort(byT).filter(x => now - new Date(x.t) <= 30 * DAY);
  const tds = (d.td || []).slice().sort(byT).filter(x => now - new Date(x.t) <= 30 * DAY);
  const vals = gs.map(x => x.v), norm = gs.filter(x => klasGula(x.v, x.tipe).c === 'ok').length;
  const kcal = []; for (let i = 0; i < 7; i++) { const k = dKey(new Date(now - i * DAY)); const m = (d.makan || []).filter(x => dKey(new Date(x.t)) === k); if (m.length) kcal.push(sum(m.map(x => 4 * x.karbo + 4 * x.protein + 9 * x.lemak))); }
  const akt = sum((d.aktivitas || []).filter(x => now - new Date(x.t) <= 7 * DAY).map(x => x.menit));
  const bmi = p.bb && p.tb ? Number(p.bb) / ((Number(p.tb) / 100) ** 2) : null;
  const cat = (d.catatan || []).slice().sort(byT).reverse();
  const ev = eventsOf(d).slice(0, 60);
  $('#detail').innerHTML = `
    <div class="dh"><div><h2>${esc(r.nama)}</h2><p>${esc(r.pid)} · ${p.usia ? esc(p.usia) + ' tahun' : 'usia –'} · ${JK[p.jk] || 'JK –'}${p.faskes ? ' · ' + esc(p.faskes) : ''}${p.kode ? ' · kode ' + esc(p.kode) : ''}</p></div>
      <button class="btn sm" id="d-close" type="button">Tutup</button></div>
    <div class="dact"><button class="btn sm" id="d-csv" type="button">Unduh CSV pasien</button><button class="btn sm" id="d-print" type="button">Cetak laporan</button></div>
    ${r.flags.length ? `<div class="flags" style="margin-bottom:6px">${r.flags.map(f => `<span class="flag l${f.lv}">${esc(f.t)}</span>`).join('')}</div>` : ''}
    <div class="stats">
      <div><b>${p.bb ? fmt(Number(p.bb), 1) : '–'}</b><small>BB kg</small></div><div><b>${p.tb ? fmt(Number(p.tb)) : '–'}</b><small>TB cm</small></div>
      <div><b>${bmi ? fmt(bmi, 1) : '–'}</b><small>IMT</small></div><div><b>${p.perut ? fmt(Number(p.perut)) : '–'}</b><small>perut cm</small></div></div>
    <div class="sec"><h3>Gula darah, 30 hari</h3>
      <div class="stats" style="margin-bottom:8px"><div><b>${vals.length ? fmt(avg(vals)) : '–'}</b><small>rata-rata mg/dL</small></div><div><b>${vals.length ? Math.min(...vals) + '–' + Math.max(...vals) : '–'}</b><small>terendah–tertinggi</small></div><div><b>${gs.length ? Math.round(norm / gs.length * 100) + '%' : '–'}</b><small>rentang normal</small></div><div><b>${gs.length}</b><small>pengukuran</small></div></div>
      ${lineChart({ series: [{ pts: gs.map(x => ({ t: +new Date(x.t), v: x.v, c: COL[klasGula(x.v, x.tipe).c] })), color: '#12372A' }], bands: [{ from: 70, to: 140, color: 'rgba(46,158,91,.13)' }], yMin: 40, label: 'Grafik gula darah' })}</div>
    <div class="sec"><h3>Tekanan darah, 30 hari</h3>${lineChart({ series: [{ name: 'Sistolik', color: '#12372A', pts: tds.map(x => ({ t: +new Date(x.t), v: x.sis })) }, { name: 'Diastolik', color: '#E8710A', pts: tds.map(x => ({ t: +new Date(x.t), v: x.dia })) }], bands: [{ from: 90, to: 130, color: 'rgba(46,158,91,.10)' }], yMin: 40, label: 'Grafik tekanan darah' })}</div>
    <div class="sec"><h3>Gaya hidup dan obat</h3>
      <div class="stats"><div><b>${r.ad == null ? '–' : r.ad + '%'}</b><small>kepatuhan obat 7 hari</small></div><div><b>${fmt(r.steps)}</b><small>langkah/hari (7 hari)</small></div><div><b>${kcal.length ? fmt(avg(kcal)) : '–'}</b><small>kkal/hari (7 hari)</small></div><div><b>${fmt(akt)}</b><small>menit latihan (7 hari)</small></div></div>
      ${(d.obat || []).length ? `<table class="mini" style="margin-top:8px"><thead><tr><th>Obat</th><th>Dosis (sesuai resep pasien)</th><th>Jam</th><th>Status</th></tr></thead><tbody>${d.obat.map(o => `<tr><td>${esc(o.nama)}</td><td>${esc(o.dosis)}</td><td>${(o.jam || []).join(', ')}</td><td>${o.aktif ? 'Aktif' : 'Dijeda'}</td></tr>`).join('')}</tbody></table>` : '<p class="hint">Pasien belum mengisi jadwal obat.</p>'}</div>
    <div class="sec"><h3>Catatan tenaga kesehatan</h3>
      <textarea id="note-text" maxlength="1000" placeholder="Tulis catatan atau saran untuk pasien. Pasien akan melihatnya di aplikasinya."></textarea>
      <div style="margin-top:8px"><button class="btn pine sm" id="note-add" type="button">Simpan catatan</button></div>
      <p class="hint">Catatan ini terlihat oleh pasien dan oleh semua staf. Jangan menulis hal yang tidak ingin dibaca pasien.</p>
      ${cat.map(c => `<div class="note-item"><p>${esc(c.isi)}</p><small><span>${esc(c.staf)} · ${fmtDT(new Date(c.t))}</span><button type="button" data-delnote="${esc(c.id)}">Hapus</button></small></div>`).join('')}</div>
    <div class="sec"><h3>Riwayat terbaru</h3>${ev.length ? `<table class="mini"><thead><tr><th>Waktu</th><th>Jenis</th><th>Keterangan</th></tr></thead><tbody>${ev.map(e => `<tr><td>${fmtDT(e.t)}</td><td>${e.j}</td><td>${esc(e.v)}</td></tr>`).join('')}</tbody></table>` : '<p class="hint">Belum ada catatan.</p>'}</div>`;
}
function openDetail(pid) {
  openPid = pid; renderDetail();
  $('#detail').hidden = false; $('#backdrop').hidden = false; $('#detail').scrollTop = 0;
  $('#d-close').focus();
}
function closeDetail() { openPid = null; $('#detail').hidden = true; $('#backdrop').hidden = true; }

/* ---------- CSV ---------- */
const csvEsc = v => { v = String(v ?? ''); return /[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
function buildCSV(pids) {
  const rows = [['pasien_id', 'nama', 'kode_responden', 'jenis', 'waktu', 'nilai', 'satuan', 'keterangan']];
  pids.forEach(pid => {
    const p = DB.pasien.find(x => x.pid === pid); if (!p) return;
    const d = DB.data[pid] || {}, nm = p.nama || '', kd = (p.profil && p.profil.kode) || '';
    const add = (j, t, v, u, k) => rows.push([pid, nm, kd, j, t, v, u, k]);
    (d.gula || []).forEach(x => add('gula_darah', x.t, x.v, 'mg/dL', `${TIPE[x.tipe]}; ${klasGula(x.v, x.tipe).t}${x.cat ? '; ' + x.cat : ''}`));
    (d.td || []).forEach(x => add('tekanan_darah', x.t, `${x.sis}/${x.dia}`, 'mmHg', x.nadi ? 'nadi ' + x.nadi : ''));
    (d.makan || []).forEach(x => add('makan', x.t, Math.round(4 * x.karbo + 4 * x.protein + 9 * x.lemak), 'kkal', `${x.waktu}; ${x.nama}; karbo ${x.karbo} g; protein ${x.protein} g; lemak ${x.lemak} g`));
    (d.aktivitas || []).forEach(x => add('aktivitas', x.t, x.menit, 'menit', `${x.jenis}; ${x.kcal} kkal`));
    (d.langkah || []).forEach(x => add('langkah', x.tgl, x.n, 'langkah', ''));
    (d.minumobat || []).forEach(x => { const o = (d.obat || []).find(m => m.id === x.obatId); add('minum_obat', x.t, 1, 'dosis', `${o ? o.nama : ''}; jadwal ${x.jam}`); });
    (d.skrining || []).forEach(x => add('skrining_risiko', x.t, x.skor, 'skor', 'Berisiko ' + x.kat));
    (d.kuis || []).forEach(x => add('kuis_edukasi', x.t, x.skor, `dari ${x.total}`, ''));
    (d.catatan || []).forEach(x => add('catatan_nakes', x.t, '', '', `${x.staf}: ${x.isi}`));
  });
  return '\ufeff' + rows.map(r => r.map(csvEsc).join(',')).join('\r\n');
}
function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/* ---------- alur ---------- */
function showLogin(msg) {
  closeDetail(); $('#app').hidden = true; $('#login').hidden = false;
  $('#login-msg').textContent = msg || '';
  $('#login-form').elements.password.value = '';
  $('#login-form').elements.username.focus();
}
async function muat(manual) {
  try {
    const j = await api('staf_semua');
    if (!j.ok) { if (j.kode === 'SESI') { sessionStorage.removeItem(SS_KEY); SES = null; return showLogin(j.error); } throw new Error(j.error); }
    DB = { pasien: j.pasien || [], data: j.data || {} };
    SES.nama = j.nama; SES.peran = j.peran; sessionStorage.setItem(SS_KEY, JSON.stringify(SES));
    buildRows(); renderKpis(); renderTable();
    $('#who').textContent = `${SES.nama}${SES.peran ? ' · ' + SES.peran : ''}`;
    $('#updated').textContent = 'Diperbarui ' + hhmm(new Date()).replace(':', '.');
    $('#login').hidden = true; $('#app').hidden = false;
    if (openPid) renderDetail();
    if (manual) toast('Data diperbarui.');
  } catch (e) { toast('Gagal memuat data: ' + (e.message || e)); if ($('#app').hidden) showLogin('Gagal terhubung ke server. Periksa internet dan pengaturan config.js.'); }
}

function init() {
  if (!CFG.SYNC_URL) { $('#login-msg').textContent = 'Alamat server belum diisi. Isi SYNC_URL di js/config.js (lihat README).'; $('#login-form button').disabled = true; return; }
  try { SES = JSON.parse(sessionStorage.getItem(SS_KEY) || 'null'); } catch (e) { SES = null; }
  renderHead();

  $('#login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target.elements, btn = e.target.querySelector('button');
    btn.disabled = true; $('#login-msg').textContent = 'Memeriksa...';
    try {
      const j = await api('staf_masuk', { username: f.username.value.trim(), password: f.password.value });
      if (!j.ok) { $('#login-msg').textContent = j.error || 'Gagal masuk.'; return; }
      SES = { token: j.token, nama: j.nama, peran: j.peran };
      sessionStorage.setItem(SS_KEY, JSON.stringify(SES));
      $('#login-msg').textContent = ''; f.password.value = '';
      await muat();
    } catch (err) { $('#login-msg').textContent = 'Tidak dapat terhubung ke server.'; }
    finally { btn.disabled = false; }
  });
  $('#btn-refresh').addEventListener('click', () => muat(true));
  $('#btn-logout').addEventListener('click', async () => {
    try { await api('staf_keluar'); } catch (e) { }
    sessionStorage.removeItem(SS_KEY); SES = null; DB = { pasien: [], data: {} }; showLogin('Anda sudah keluar.');
  });
  $('#btn-csv-all').addEventListener('click', () => { download(`sigap-dm-semua-pasien-${dKey(new Date())}.csv`, buildCSV(DB.pasien.map(p => p.pid))); toast('CSV diunduh.'); });
  $('#q').addEventListener('input', renderTable);
  $('#flt').addEventListener('change', renderTable);
  const sortHandler = e => {
    const th = e.target.closest('th[data-k]'); if (!th) return;
    if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
    const k = th.dataset.k; sortBy = { k, dir: sortBy.k === k ? -sortBy.dir : (k === 'nama' ? 1 : -1) };
    renderHead(); renderTable();
  };
  $('#thead').addEventListener('click', sortHandler); $('#thead').addEventListener('keydown', sortHandler);
  $('#tbody').addEventListener('click', e => { const b = e.target.closest('[data-pid]'); if (b) openDetail(b.dataset.pid); });
  $('#backdrop').addEventListener('click', closeDetail);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && openPid) closeDetail(); });

  $('#detail').addEventListener('click', async e => {
    const t = e.target;
    if (t.id === 'd-close') return closeDetail();
    if (t.id === 'd-print') return window.print();
    if (t.id === 'd-csv') { const r = ROWS.find(x => x.pid === openPid); download(`sigap-dm-${openPid}-${dKey(new Date())}.csv`, buildCSV([openPid])); return toast('CSV diunduh.'); }
    if (t.id === 'note-add') {
      const ta = $('#note-text'), isi = ta.value.trim(); if (!isi) return toast('Tulis catatan terlebih dahulu.');
      const r = ROWS.find(x => x.pid === openPid); t.disabled = true;
      try {
        const j = await api('staf_catatan_tambah', { pid: openPid, nama: r ? r.nama : '', isi });
        if (!j.ok) { if (j.kode === 'SESI') return showLogin(j.error); return toast(j.error || 'Gagal menyimpan catatan.'); }
        (DB.data[openPid] = DB.data[openPid] || {}).catatan = [...((DB.data[openPid] || {}).catatan || []), j.rec];
        buildRows(); renderTable(); renderDetail(); toast('Catatan disimpan.');
      } catch (err) { toast('Gagal terhubung ke server.'); } finally { t.disabled = false; }
      return;
    }
    const del = t.closest('[data-delnote]');
    if (del) {
      if (!confirm('Hapus catatan ini? Pasien tidak akan melihatnya lagi.')) return;
      try {
        const j = await api('staf_catatan_hapus', { pid: openPid, id: del.dataset.delnote });
        if (!j.ok) return toast(j.error || 'Gagal menghapus.');
        DB.data[openPid].catatan = (DB.data[openPid].catatan || []).filter(c => c.id !== del.dataset.delnote);
        buildRows(); renderTable(); renderDetail(); toast('Catatan dihapus.');
      } catch (err) { toast('Gagal terhubung ke server.'); }
    }
  });

  setInterval(() => { if (SES && !$('#app').hidden && !openPid) muat(); }, 300000);
  if (SES && SES.token) muat(); else showLogin();
}
document.addEventListener('DOMContentLoaded', init);
})();
