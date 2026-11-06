/**
 * SIGAP-DM — server rekam medis sederhana di Google Sheets (Google Apps Script)
 *
 * Cara pakai singkat (lengkap di README.md):
 * 1. Buat Google Sheets baru > menu Ekstensi > Apps Script.
 * 2. Hapus isi Code.gs bawaan, tempel seluruh berkas ini.
 * 3. Ganti TOKEN dan GARAM di bawah dengan teks acak buatan Anda.
 * 4. Terapkan > Deployment baru > Aplikasi web > Jalankan sebagai: Saya; Yang memiliki akses: Siapa saja > Terapkan.
 * 5. Salin URL aplikasi web ke js/config.js (SYNC_URL), dan TOKEN yang sama.
 *
 * Akun: tiap pasien punya ID (mis. P-4F7K2A) dan PIN 6 angka. PIN disimpan sebagai hash (bukan teks asli).
 * Dengan ID + PIN, pasien bisa masuk dari HP atau laptop lain dan seluruh datanya dimuat kembali.
 * Setiap catatan diperbarui berdasarkan ID-nya (tidak digandakan) dan dihapus bila pengguna menghapusnya.
 * Sheet "Riwayat" menggabungkan semua catatan semua pasien dalam satu daftar yang bisa difilter per nama.
 */
const TOKEN = 'GANTI-DENGAN-KATA-SANDI-ACAK';
const GARAM = 'GANTI-DENGAN-TEKS-ACAK-LAIN';

const NAMA_SHEET = {
  pasien: 'Pasien', gula: 'GulaDarah', td: 'TekananDarah', makan: 'Makan', aktivitas: 'Aktivitas',
  langkah: 'Langkah', obat: 'JadwalObat', minumobat: 'MinumObat', skrining: 'Skrining', kuis: 'Kuis',
  catatan: 'CatatanKlinis' // ditulis oleh tenaga kesehatan lewat dashboard, hanya dibaca oleh aplikasi pasien
};
// sheet yang boleh ditulis oleh aplikasi pasien (catatan klinis TIDAK termasuk)
const SHEET_PASIEN_BOLEH = ['pasien', 'gula', 'td', 'makan', 'aktivitas', 'langkah', 'obat', 'minumobat', 'skrining', 'kuis'];
const SHEET_STAF = 'Staf';
const SESI_DETIK = 21600; // sesi dashboard 6 jam (batas maksimum CacheService)
const SHEET_RIWAYAT = 'Riwayat';
const KOLOM_DASAR = ['id', 'pasien_id', 'nama'];
const KOLOM_TEKS = ['id', 'pasien_id', '_json', 'pin_hash']; // disimpan sebagai teks agar tidak diubah Sheets
const MAKS_GAGAL = 5;     // percobaan PIN salah sebelum dikunci
const KUNCI_DETIK = 900;  // lama dikunci: 15 menit

function doGet() {
  return keluar({ ok: true, pesan: 'SIGAP-DM server aktif' });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
    const p = JSON.parse(e.postData.contents);
    if (p.token !== TOKEN) return keluar({ ok: false, error: 'token salah' });
    const aksi = p.aksi || 'sync';
    if (String(aksi).indexOf('staf_') === 0) return keluar(aksiStaf(SpreadsheetApp.getActiveSpreadsheet(), aksi, p));
    const pid = String(p.pid || '');
    if (!/^P-[A-Z0-9]{6}$/.test(pid)) return keluar({ ok: false, error: 'ID tidak valid' });
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (aksi === 'daftar') return keluar(daftar(ss, p, pid));

    const cek = verifikasi(ss, pid, p.pin);
    if (!cek.ok) return keluar(cek);

    if (aksi === 'masuk' || aksi === 'tarik') return keluar({ ok: true, data: ambilSemua(ss, pid) });

    const pas = p.pasien || {};
    let diproses = 0;
    (p.ops || []).forEach(function (op) {
      const nama = NAMA_SHEET[op.sheet];
      if (!nama || SHEET_PASIEN_BOLEH.indexOf(op.sheet) < 0 || op.id === undefined || op.id === null) return;
      const id = String(op.id);
      if (op.sheet === 'pasien' && id !== pid) return; // pasien hanya boleh mengubah profilnya sendiri
      if (op.del) {
        hapusBaris(ss, nama, id);
        hapusBaris(ss, SHEET_RIWAYAT, op.sheet + ':' + id);
      } else {
        const row = Object.assign({}, op.row || {});
        delete row.pin_hash;
        row.id = id;
        row.pasien_id = pid;
        row.nama = pas.nama || row.nama || '';
        simpanBaris(ss, nama, row);
        if (op.sheet !== 'pasien') {
          simpanBaris(ss, SHEET_RIWAYAT, {
            id: op.sheet + ':' + id, pasien_id: pid, nama: row.nama,
            waktu: row.waktu || row.tanggal || new Date(), jenis: nama, ringkasan: ringkas(row)
          });
        }
      }
      diproses++;
    });
    return keluar({ ok: true, diproses: diproses });
  } catch (err) {
    return keluar({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (x) { }
  }
}

/* ---------- akun ---------- */

function hashPin(pid, pin) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, GARAM + ':' + pid + ':' + pin);
  return Utilities.base64Encode(bytes);
}

function daftar(ss, p, pid) {
  if (!/^\d{6}$/.test(String(p.pin || ''))) return { ok: false, error: 'PIN harus 6 angka' };
  if (cariBaris(ss, NAMA_SHEET.pasien, pid) > 0) return { ok: false, error: 'ID sudah dipakai', kode: 'ID_ADA' };
  const row = Object.assign({}, p.row || {});
  row.id = pid;
  row.pasien_id = pid;
  row.nama = p.nama || row.nama || '';
  row.pin_hash = hashPin(pid, String(p.pin));
  simpanBaris(ss, NAMA_SHEET.pasien, row);
  return { ok: true };
}

function verifikasi(ss, pid, pin) {
  const cache = CacheService.getScriptCache();
  const kk = 'gagal:' + pid;
  const n = Number(cache.get(kk) || 0);
  if (n >= MAKS_GAGAL) return { ok: false, error: 'Terlalu banyak percobaan. Coba lagi 15 menit lagi.' };
  const baris = cariBaris(ss, NAMA_SHEET.pasien, pid);
  if (baris < 0) return { ok: false, error: 'ID tidak ditemukan', kode: 'TIDAK_ADA' };
  const sh = ss.getSheetByName(NAMA_SHEET.pasien);
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const kol = head.indexOf('pin_hash');
  const tersimpan = kol < 0 ? '' : String(sh.getRange(baris, kol + 1).getValue());
  if (!tersimpan || tersimpan !== hashPin(pid, String(pin || ''))) {
    cache.put(kk, String(n + 1), KUNCI_DETIK);
    return { ok: false, error: 'PIN salah' };
  }
  cache.remove(kk);
  return { ok: true };
}

// Membaca semua rekaman satu sheet: [{pid, rec}] (rec = salinan asli dari kolom _json)
function bacaRekaman(ss, k) {
  const hasil = [];
  const sh = ss.getSheetByName(NAMA_SHEET[k]);
  if (!sh || sh.getLastRow() < 2) return hasil;
  const v = sh.getDataRange().getValues();
  const ip = v[0].indexOf('pasien_id'), ij = v[0].indexOf('_json');
  if (ip < 0 || ij < 0) return hasil;
  for (let i = 1; i < v.length; i++) {
    if (!v[i][ij]) continue;
    try { hasil.push({ pid: String(v[i][ip]), rec: JSON.parse(v[i][ij]) }); } catch (x) { }
  }
  return hasil;
}

function ambilSemua(ss, pid) {
  const out = {};
  Object.keys(NAMA_SHEET).forEach(function (k) {
    out[k] = bacaRekaman(ss, k).filter(function (x) { return x.pid === pid; }).map(function (x) { return x.rec; });
  });
  return out;
}

/* ---------- baris ---------- */

function ringkas(row) {
  const lewati = ['id', 'pasien_id', 'nama', 'waktu', 'tanggal', 'diperbarui', '_json', 'pin_hash'];
  return Object.keys(row).filter(function (k) { return lewati.indexOf(k) < 0 && row[k] !== '' && row[k] !== undefined; })
    .map(function (k) { return k + ': ' + row[k]; }).join('; ');
}

function ambilSheet(ss, nama) {
  let sh = ss.getSheetByName(nama);
  if (!sh) sh = ss.insertSheet(nama);
  return sh;
}

function cariBaris(ss, nama, id) {
  const sh = ss.getSheetByName(nama);
  if (!sh || sh.getLastRow() < 2) return -1;
  const ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

function simpanBaris(ss, nama, obj) {
  const sh = ambilSheet(ss, nama);
  obj.diperbarui = new Date();
  const adaKolom = sh.getLastColumn();
  let head = adaKolom > 0 ? sh.getRange(1, 1, 1, adaKolom).getValues()[0] : KOLOM_DASAR.slice();
  const baruMulai = adaKolom > 0 ? head.length : 0; // kolom di bawah indeks ini sudah ada sebelumnya
  Object.keys(obj).forEach(function (k) { if (head.indexOf(k) < 0) head.push(k); });
  head.forEach(function (h, i) {
    if (i >= baruMulai && KOLOM_TEKS.indexOf(h) >= 0) sh.getRange(1, i + 1, sh.getMaxRows(), 1).setNumberFormat('@');
  });
  sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
  sh.setFrozenRows(1);

  const baris = cariBaris(ss, nama, obj.id);
  if (baris > 0) {
    const sebelum = sh.getRange(baris, 1, 1, head.length).getValues()[0];
    const baru = head.map(function (h, i) { return obj[h] !== undefined ? obj[h] : sebelum[i]; });
    sh.getRange(baris, 1, 1, head.length).setValues([baru]);
  } else {
    const baru = head.map(function (h) { return obj[h] !== undefined ? obj[h] : ''; });
    sh.getRange(sh.getLastRow() + 1, 1, 1, head.length).setValues([baru]);
  }
}

function hapusBaris(ss, nama, id) {
  const baris = cariBaris(ss, nama, id);
  if (baris > 0) ss.getSheetByName(nama).deleteRow(baris);
}

function keluar(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ==================== DASHBOARD TENAGA KESEHATAN / PENELITI ==================== */

function hashStaf(username, password) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, GARAM + ':staf:' + username + ':' + password);
  return Utilities.base64Encode(bytes);
}

function cariStaf(ss, username) {
  const sh = ss.getSheetByName(SHEET_STAF);
  if (!sh || sh.getLastRow() < 2) return -1;
  const v = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < v.length; i++) { if (String(v[i][0]) === username) return i + 2; }
  return -1;
}

function aksiStaf(ss, aksi, p) {
  const cache = CacheService.getScriptCache();
  if (aksi === 'staf_masuk') return stafMasuk(ss, p);
  const mentah = cache.get('staf:' + String(p.stafToken || ''));
  if (!mentah) return { ok: false, error: 'Sesi habis. Silakan masuk lagi.', kode: 'SESI' };
  const sesi = JSON.parse(mentah);

  if (aksi === 'staf_keluar') { cache.remove('staf:' + p.stafToken); return { ok: true }; }

  if (aksi === 'staf_semua') {
    const pasien = [];
    const sh = ss.getSheetByName(NAMA_SHEET.pasien);
    if (sh && sh.getLastRow() > 1) {
      const v = sh.getDataRange().getValues(), h = v[0];
      const ii = h.indexOf('id'), inm = h.indexOf('nama'), ij = h.indexOf('_json'), iu = h.indexOf('diperbarui');
      for (let i = 1; i < v.length; i++) {
        let profil = {};
        try { profil = JSON.parse(v[i][ij] || '{}'); } catch (x) { }
        pasien.push({ pid: String(v[i][ii]), nama: String(v[i][inm] || ''), diperbarui: iu >= 0 ? v[i][iu] : '', profil: profil });
      }
    }
    const data = {};
    Object.keys(NAMA_SHEET).forEach(function (k) {
      if (k === 'pasien') return;
      bacaRekaman(ss, k).forEach(function (x) {
        if (!data[x.pid]) data[x.pid] = {};
        if (!data[x.pid][k]) data[x.pid][k] = [];
        data[x.pid][k].push(x.rec);
      });
    });
    return { ok: true, nama: sesi.nama, peran: sesi.peran, pasien: pasien, data: data };
  }

  if (aksi === 'staf_catatan_tambah') {
    const pid = String(p.pid || '');
    let isi = String(p.isi || '').trim();
    if (!/^P-[A-Z0-9]{6}$/.test(pid) || !isi) return { ok: false, error: 'Catatan kosong atau ID pasien tidak valid' };
    if (cariBaris(ss, NAMA_SHEET.pasien, pid) < 0) return { ok: false, error: 'Pasien tidak ditemukan' };
    if (isi.length > 1000) isi = isi.slice(0, 1000);
    const rec = { id: 'C' + Utilities.getUuid().replace(/-/g, '').slice(0, 12), pid: pid, t: new Date().toISOString(), staf: sesi.nama, isi: isi };
    simpanBaris(ss, NAMA_SHEET.catatan, { id: rec.id, pasien_id: pid, nama: String(p.nama || ''), waktu: new Date(), staf: sesi.nama, isi: isi, _json: JSON.stringify(rec) });
    return { ok: true, rec: rec };
  }

  if (aksi === 'staf_catatan_hapus') {
    const baris = cariBaris(ss, NAMA_SHEET.catatan, String(p.id || ''));
    if (baris < 0) return { ok: false, error: 'Catatan tidak ditemukan' };
    const sh = ss.getSheetByName(NAMA_SHEET.catatan);
    const h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    if (String(sh.getRange(baris, h.indexOf('pasien_id') + 1).getValue()) !== String(p.pid || '')) return { ok: false, error: 'Catatan bukan milik pasien ini' };
    sh.deleteRow(baris);
    return { ok: true };
  }
  return { ok: false, error: 'Aksi tidak dikenal' };
}

function stafMasuk(ss, p) {
  const u = String(p.username || '').trim().toLowerCase();
  const pw = String(p.password || '');
  const cache = CacheService.getScriptCache();
  const kk = 'gagalstaf:' + u;
  const n = Number(cache.get(kk) || 0);
  if (n >= MAKS_GAGAL) return { ok: false, error: 'Terlalu banyak percobaan. Coba lagi 15 menit lagi.' };
  const baris = u ? cariStaf(ss, u) : -1;
  const sh = ss.getSheetByName(SHEET_STAF);
  const r = baris > 0 ? sh.getRange(baris, 1, 1, 4).getValues()[0] : null; // username, pass_hash, nama, peran
  if (!r || String(r[1]) !== hashStaf(u, pw)) {
    cache.put(kk, String(n + 1), KUNCI_DETIK);
    return { ok: false, error: 'Nama pengguna atau kata sandi salah' };
  }
  cache.remove(kk);
  const token = Utilities.getUuid() + Utilities.getUuid();
  cache.put('staf:' + token, JSON.stringify({ u: u, nama: String(r[2]), peran: String(r[3]) }), SESI_DETIK);
  return { ok: true, token: token, nama: String(r[2]), peran: String(r[3]) };
}

/**
 * MEMBUAT / MERESET AKUN STAF — dijalankan MANUAL oleh pemilik spreadsheet dari editor Apps Script:
 *   1. Ubah nilai di dalam fungsi buatAkunStaf() di bawah (nama pengguna, kata sandi, nama, peran).
 *   2. Pilih fungsi buatAkunStaf di menu atas editor, klik Jalankan.
 *   3. SETELAH ITU hapus kata sandi dari kode (ganti dengan teks lain) lalu simpan.
 * Menjalankan lagi dengan nama pengguna yang sama = mengganti kata sandi.
 */
function tambahStaf(username, password, nama, peran) {
  const u = String(username || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(u)) throw new Error('Nama pengguna 3-30 karakter: huruf kecil, angka, titik, strip');
  if (String(password || '').length < 8) throw new Error('Kata sandi minimal 8 karakter');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_STAF);
  if (!sh) {
    sh = ss.insertSheet(SHEET_STAF);
    sh.getRange(1, 1, 1, 5).setValues([['username', 'pass_hash', 'nama', 'peran', 'dibuat']]).setFontWeight('bold');
    sh.getRange(1, 1, sh.getMaxRows(), 2).setNumberFormat('@');
    sh.setFrozenRows(1);
  }
  const baris = cariStaf(ss, u);
  const isi = [u, hashStaf(u, String(password)), String(nama || u), String(peran || 'nakes'), new Date()];
  if (baris > 0) sh.getRange(baris, 1, 1, 5).setValues([isi]);
  else sh.getRange(sh.getLastRow() + 1, 1, 1, 5).setValues([isi]);
  Logger.log('Akun staf siap: ' + u);
}

function hapusStaf(username) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const baris = cariStaf(ss, String(username || '').trim().toLowerCase());
  if (baris > 0) { ss.getSheetByName(SHEET_STAF).deleteRow(baris); Logger.log('Akun staf dihapus'); }
}

function buatAkunStaf() {
  // Contoh. Ganti keempat nilai ini, jalankan sekali, lalu hapus kata sandinya dari kode.
  tambahStaf('peneliti', 'GantiDenganKataSandiKuat', 'Peneliti', 'peneliti');
}

function hapusAkunStaf() {
  hapusStaf('peneliti');
}
