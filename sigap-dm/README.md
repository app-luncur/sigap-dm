# SIGAP-DM — Sistem Informasi Gula Darah Prima (Diabetes Melitus)

Paket lengkap untuk penelitian tesis, terdiri dari tiga bagian:

| Bagian | Untuk siapa | Bentuk |
|---|---|---|
| **Aplikasi pasien** | Responden/pasien | Aplikasi web (PWA) yang dipasang di layar utama HP; bisa juga dibuka di laptop |
| **Dashboard** | Tenaga kesehatan dan peneliti (login sendiri) | Halaman web: daftar semua pasien, peringatan, grafik, catatan klinis, ekspor CSV |
| **Server rekam medis** | Otomatis | Google Sheets + Google Apps Script (gratis) |

```
HP / laptop pasien ──kirim & muat──▶  Google Apps Script  ◀──▶  Google Sheets Anda
 (aplikasi SIGAP-DM)   (ID + PIN)     (server gratis)           (rekam medis semua pasien)
                                              ▲
 Laptop tenaga kesehatan ─────────────────────┘
 (Dashboard, login nama pengguna + kata sandi)
```

**Biaya: Rp0.** Tidak ada langganan bulanan, tidak ada akun developer, tidak ada Google Play. Domain sendiri bersifat opsional dan berbayar per tahun.

Format: **bukan .apk**. Aplikasi pasien dibuka lewat alamat web lalu dipasang dari Chrome/Safari. Jika kampus mewajibkan .apk, folder ini bisa dibungkus dengan PWABuilder atau Capacitor (tidak dibahas di sini).

---

## Isi paket

```
sigap-dm/
├── index.html, css/, js/       aplikasi pasien
│   └── js/config.js            ← PENGATURAN: alamat server dan token (Langkah 4)
├── dashboard/                  dashboard tenaga kesehatan
├── server/Code.gs              ← KODE SERVER untuk Google Apps Script (Langkah 2)
├── sw.js, manifest.webmanifest, icons/    agar bisa dipasang dan dibuka tanpa internet
├── mulai-lokal.bat / .sh       menjalankan di komputer untuk uji coba (butuh Python)
└── README.md                   berkas ini
```

## Yang perlu disiapkan

1. **Akun Google** (Gmail biasa) untuk spreadsheet dan server.
2. **Akun hosting statis gratis**: pilih salah satu — Cloudflare Pages, Netlify, atau GitHub.
3. **Laptop/PC** (Windows/macOS/Linux) dengan Chrome atau Edge, dan Notepad atau editor teks apa saja.
4. **HP** Android (Chrome) atau iPhone (Safari) untuk uji coba.
5. Opsional: **Python 3** untuk uji coba di komputer sebelum diunggah.

Perkiraan waktu: 30–45 menit.

---

## Langkah 1 — Ekstrak paket

1. Ekstrak file `SIGAP-DM.zip` ke folder, misalnya `Documents\sigap-dm`.
2. Pastikan di dalamnya ada `index.html`, folder `dashboard`, `js`, `server`, dan seterusnya. Jangan mengubah nama folder.

## Langkah 2 — Pasang server rekam medis (Google Sheets + Apps Script)

1. Buka **sheets.google.com**, login, lalu buat **spreadsheet kosong**. Beri nama `SIGAP-DM Rekam Medis`.
2. Di spreadsheet itu, klik menu **Ekstensi → Apps Script**. Tab baru terbuka.
3. Di editor, **hapus semua kode bawaan** (`function myFunction() {...}`).
4. Buka `server/Code.gs` dari paket dengan Notepad, **salin seluruh isinya**, lalu **tempel** ke editor Apps Script.
5. Di bagian atas kode, ganti dua teks berikut dengan teks acak buatan Anda (panjang, campuran huruf dan angka):
   ```js
   const TOKEN = 'GANTI-DENGAN-KATA-SANDI-ACAK';
   const GARAM = 'GANTI-DENGAN-TEKS-ACAK-LAIN';
   ```
   - **TOKEN**: catat, dipakai lagi di Langkah 4.
   - **GARAM**: pengaman PIN pasien dan kata sandi staf. Tidak perlu dicatat, tetapi **jangan diubah lagi** setelah ada akun terdaftar (semua PIN dan kata sandi lama menjadi tidak berlaku).
6. Klik ikon **simpan** (disket) di editor.
7. Klik **Terapkan → Deployment baru**.
8. Klik ikon **roda gigi** di samping "Pilih jenis" lalu pilih **Aplikasi web**.
9. Isi:
   - *Deskripsi*: `SIGAP-DM`
   - *Jalankan sebagai*: **Saya** (akun Anda)
   - *Yang memiliki akses*: **Siapa saja**
10. Klik **Terapkan**. Jika diminta izin: **Beri otorisasi akses** → pilih akun Anda → bila muncul "Google belum memverifikasi aplikasi ini", klik **Lanjutan → Buka SIGAP-DM (tidak aman)** → **Izinkan**. Ini aman karena skrip itu milik Anda sendiri.
11. **Salin "URL aplikasi web"** (berakhiran `/exec`) dan simpan.
12. Uji: tempel URL itu di tab browser baru. Jika tampil `{"ok":true,"pesan":"SIGAP-DM server aktif"}`, server siap.

> **Jika kelak Anda mengubah `Code.gs`:** buat versi baru agar perubahan berlaku, yaitu **Terapkan → Kelola deployment → ikon pensil → Versi: Versi baru → Terapkan**. URL tetap sama.

## Langkah 3 — Buat akun staf untuk dashboard

Akun staf **tidak bisa mendaftar sendiri**; hanya Anda (pemilik spreadsheet) yang dapat membuatnya.

1. Di editor Apps Script, cari fungsi di bagian bawah:
   ```js
   function buatAkunStaf() {
     tambahStaf('dr.budi', 'GantiDenganKataSandiKuat', 'dr. Budi', 'nakes');
   }
   ```
2. Ubah keempat isiannya:
   - **nama pengguna**: huruf kecil, angka, titik, atau strip (3–30 karakter), mis. `dr.siti`
   - **kata sandi**: minimal 8 karakter, mis. campuran huruf, angka, simbol
   - **nama tampilan**: mis. `dr. Siti`
   - **peran**: bebas, mis. `nakes` atau `peneliti`
3. Klik ikon **simpan**. Di dropdown fungsi di bilah atas editor, pilih **buatAkunStaf**, lalu klik **Jalankan**.
4. Pertama kali, Google meminta izin (langkah izin sama seperti di Langkah 2.10). Setelah itu lihat **Log eksekusi** di bawah: harus muncul "Akun staf ... disimpan".
5. **Segera hapus kata sandi dari kode** (ganti kembali dengan teks bebas) lalu simpan. Kata sandi sudah tersimpan dalam bentuk hash di sheet **Staf**.
6. Untuk **menambah staf lain**, ulangi langkah 1–5 dengan nama pengguna berbeda. Untuk **reset kata sandi**, jalankan lagi dengan nama pengguna yang sama dan kata sandi baru. Untuk **menghapus** staf, ubah isi `hapusAkunStaf()` lalu jalankan.

## Langkah 4 — Hubungkan aplikasi ke server

Buka `js/config.js` dengan Notepad dan isi:

```js
window.SIGAP_CONFIG = {
  SYNC_URL: 'https://script.google.com/macros/s/AKfycb.../exec',   // URL dari Langkah 2.11
  TOKEN: 'teks-TOKEN-yang-sama-dengan-di-Code.gs'
};
```

Simpan. File ini dipakai oleh **aplikasi pasien dan dashboard sekaligus**. Jika `SYNC_URL` dikosongkan, aplikasi berjalan lokal saja (tanpa akun dan tanpa pengiriman) dan dashboard tidak bisa dipakai.

## Langkah 5 — (Opsional) Coba di komputer dulu

1. Instal Python 3 bila belum ada (python.org).
2. Windows: klik dua kali `mulai-lokal.bat`. macOS/Linux: jalankan `./mulai-lokal.sh`.
3. Aplikasi pasien: **http://localhost:8080** · Dashboard: **http://localhost:8080/dashboard/**
4. Hentikan dengan menekan Ctrl+C di jendela hitam.

Mode ini cukup untuk mencoba semua fitur, termasuk pendaftaran dan dashboard. Fitur "pasang di layar utama" dan mode tanpa internet baru aktif setelah Langkah 6 (butuh alamat https).

## Langkah 6 — Taruh online (gratis)

Unggah **isi** folder `sigap-dm` (bukan zip-nya, dan `index.html` harus berada di lapisan paling atas) ke salah satu layanan berikut. Aplikasi pasien dan dashboard ikut terunggah bersama.

### Pilihan A — Cloudflare Pages
1. Buat akun gratis di **dash.cloudflare.com**.
2. Menu **Workers & Pages → Create → tab Pages → Upload assets**.
3. Beri nama proyek (mis. `sigap-dm`), klik **Create project**.
4. Seret isi folder `sigap-dm` ke area unggah, lalu **Deploy site**.
5. Hasil: `https://sigap-dm.pages.dev` (aplikasi) dan `https://sigap-dm.pages.dev/dashboard/` (dashboard).

### Pilihan B — Netlify
1. Buka **app.netlify.com/drop** (login diminta).
2. Seret folder `sigap-dm` ke halaman itu.
3. Hasil: `https://nama-acak.netlify.app` dan `https://nama-acak.netlify.app/dashboard/`. Nama bisa diganti di *Site configuration*.

### Pilihan C — GitHub Pages
1. Buat akun di github.com, buat repository **publik** baru.
2. **Add file → Upload files**, unggah seluruh isi folder, **Commit**.
3. **Settings → Pages → Branch: main / root → Save**. Alamat muncul beberapa menit kemudian.

Syarat paket gratis dapat berubah; cek halaman harga layanan yang Anda pilih. Untuk puluhan responden biasanya lebih dari cukup.

**Memperbarui:** jika Anda mengubah berkas apa pun, unggah ulang folder dengan cara yang sama. Bila yang diubah adalah `js/app.js`, `css`, atau `js/data.js`, ubah juga nilai `VERSI` di `sw.js` (mis. `sigap-dm-v1.3.1`) agar HP yang sudah memasang aplikasi memuat versi terbaru.

## Langkah 7 — Pasang di HP pasien dan buat akun

1. Di HP, buka alamat aplikasi (Langkah 6).
2. **Android (Chrome)**: menu ⋮ → **Instal aplikasi** / **Tambahkan ke layar utama**. **iPhone (Safari)**: tombol Bagikan → **Tambah ke Layar Utama**.
3. Buka aplikasi dari ikon di layar utama, tekan **MULAI**, isi data diri.
4. **Centang persetujuan** jika bersedia data dikirim ke peneliti, lalu isi **PIN 6 angka** dan tekan **Simpan dan masuk**.
5. Aplikasi menampilkan **ID pasien** (mis. `P-4F7K2A`). **Minta pasien mencatat ID dan PIN-nya.** ID juga selalu tersedia di menu Profil.

**Masuk dari HP lain atau laptop:** buka alamat aplikasi → **Sudah punya akun? Masuk** → isi ID dan PIN. Seluruh data dimuat dari server. Data dari beberapa perangkat saling menyelaraskan saat aplikasi dibuka atau saat menekan **Profil → Muat dari server**.

**PIN lupa:** PIN tidak bisa dilihat siapa pun (disimpan sebagai hash). Peneliti dapat menghapus baris pasien itu di sheet **Pasien** (data lama tetap ada di sheet lain) dan meminta pasien mendaftar ulang.

## Langkah 8 — Memakai dashboard

1. Buka `https://alamat-anda/dashboard/` di laptop (Chrome/Edge).
2. Masuk dengan **nama pengguna dan kata sandi staf** dari Langkah 3. Sesi berlaku 6 jam; setelah itu masuk lagi.
3. **Halaman utama**: ringkasan kohort (jumlah pasien, perlu perhatian, tidak aktif, rata-rata gula 14 hari, % pengukuran normal, rata-rata kepatuhan obat) dan **tabel semua pasien**. Klik judul kolom untuk mengurutkan; gunakan kotak cari dan filter (perlu perhatian, gula rendah, gula sangat tinggi, tidak aktif, kepatuhan rendah).
4. **Peringatan otomatis** muncul bila: gula < 70 atau ≥ 300 mg/dL dalam 7 hari; rata-rata gula 7 hari ≥ 180; tekanan darah terakhir ≥ 140/90; tidak ada catatan ≥ 3 hari; kepatuhan obat 7 hari < 60%; skrining risiko tinggi (informasi). Ini alat bantu pemantauan, bukan penilaian klinis.
5. **Klik nama pasien** untuk melihat detail: profil, grafik gula darah dan tekanan darah 30 hari, kepatuhan obat dan jadwal obat, riwayat terbaru, dan **catatan tenaga kesehatan**.
6. **Catatan tenaga kesehatan**: tulis catatan atau saran lalu simpan. **Pasien melihatnya di aplikasinya** (halaman Pasien, dan di Beranda tertulis ada catatan baru) setelah aplikasi menyegarkan data.
7. **Ekspor**: *Ekspor CSV semua* (semua pasien) atau *Unduh CSV pasien* (satu pasien) untuk Excel/SPSS. *Cetak laporan* mencetak halaman detail pasien (bisa disimpan sebagai PDF).
8. Tombol **Muat ulang** menarik data terbaru; halaman juga menyegarkan sendiri setiap 5 menit saat panel detail tertutup.

## Langkah 9 — Uji coba menyeluruh sebelum dipakai responden

1. Pasang aplikasi di HP Anda, buat akun, catat ID.
2. Catat gula darah, tekanan darah, makanan, langkah. Buka spreadsheet: sheet **Pasien**, **GulaDarah**, **TekananDarah**, dan seterusnya terisi.
3. Ubah jumlah langkah dua kali dan hapus satu catatan gula darah: baris langkah **diperbarui** (tidak bertambah) dan baris yang dihapus **hilang**.
4. Matikan internet HP, catat data, nyalakan lagi: data terkirim sendiri (Profil → Akun menunjukkan statusnya).
5. Di laptop, buka aplikasi → **Masuk** dengan ID dan PIN: semua data muncul.
6. Buka **dashboard**, masuk sebagai staf: pasien uji Anda tampil. Tulis satu catatan.
7. Di aplikasi pasien, tekan **Profil → Muat dari server**, lalu lihat halaman **Pasien**: catatan tampil.
8. Coba PIN salah 5 kali (akun pasien terkunci 15 menit) dan kata sandi staf salah 5 kali (login staf terkunci 15 menit).

## Pemeliharaan

- **Cadangan data:** di Google Sheets, **File → Buat salinan** atau **File → Download → Microsoft Excel (.xlsx)**, secara berkala. Riwayat versi tersedia di **File → Histori versi**.
- **Pasien ganti HP:** cukup login dengan ID dan PIN. Pasien juga bisa **Profil → Cadangkan** untuk salinan lokal.
- **Menghapus data pasien** (atas permintaan): hapus barisnya di semua sheet terkait, atau hapus pasien dari sheet **Pasien** dan sheet lain berdasarkan `pasien_id`.
- **Kuota:** Apps Script gratis punya batas pemakaian harian; untuk puluhan responden dan dashboard yang dipakai beberapa staf biasanya cukup. Pantau saat uji coba.
- **Sheet yang dibuat otomatis:** Pasien, Riwayat (gabungan semua catatan, bisa difilter per nama), GulaDarah, TekananDarah, Makan, Aktivitas, Langkah, JadwalObat, MinumObat, Skrining, Kuis, CatatanKlinis, Staf. Kolom `_json` dan `pin_hash` dipakai sistem; **jangan diubah atau dihapus**. Mengedit angka langsung di spreadsheet tidak mengubah data di aplikasi atau dashboard.

## Privasi dan etika (data kesehatan beridentitas)

- **Token** ada di `js/config.js` dan terbaca oleh siapa pun yang membuka kode aplikasi. Bagikan alamat aplikasi hanya kepada responden dan alamat dashboard hanya kepada staf. Jangan bagikan tautan spreadsheet; biarkan hanya akun Anda yang memilikinya. Pengamanan ini cukup untuk penelitian skala kecil, **tidak memadai untuk layanan klinis sungguhan**.
- **PIN pasien dan kata sandi staf** disimpan sebagai hash, dan akun terkunci 15 menit setelah 5 kali salah. PIN 6 angka tidak sekuat kata sandi; pertimbangkan hal ini dalam penilaian risiko penelitian.
- Pasien memberi **persetujuan** di aplikasi sebelum data dikirim dan dapat **menghentikan pengiriman** (Profil → Hentikan pengiriman). Data yang sudah terkirim tetap di spreadsheet sampai Anda menghapusnya.
- Semua staf melihat **semua pasien** dan nama aslinya. Batasi jumlah staf dan hapus akun yang tidak dipakai.
- Data disimpan di server Google, di luar kendali kampus. Urus **persetujuan etik** dan **lembar persetujuan (informed consent)** sesuai ketentuan kampus, dan pertimbangkan aturan pelindungan data pribadi yang berlaku. Konsultasikan dengan pembimbing atau komisi etik.
- Untuk analisis dan lampiran tesis, **samarkan kolom nama** dan gunakan `pasien_id` atau kode responden.
- Aplikasi **tidak menentukan atau menyarankan dosis obat**; dosis diisi pasien sesuai resep dokter. Catatan tenaga kesehatan di dashboard terlihat oleh pasien.

## Fitur aplikasi pasien dan kesesuaiannya dengan PPT

| Dari PPT | Di aplikasi |
|---|---|
| Tombol MULAI, sapaan "Kak …", nama puskesmas | Layar pembuka, sapaan di Beranda, isian faskes di Profil |
| Skrining risiko mandiri | Skor, kategori rendah/sedang/tinggi, riwayat |
| Pencatatan gula darah | Puasa, sewaktu, 2 jam setelah makan, status otomatis, saran |
| Pemantauan kepatuhan obat | Jadwal, centang dosis, persentase 7 hari, pengingat |
| Laporan dan grafik tren | 7/14/30/90 hari, grafik, cetak/PDF, CSV, bagikan WhatsApp |
| Manajemen pola makan | Donut karbo/protein/lemak, gauge kalori, 30 makanan, 5 resep, WhatsApp ahli gizi |
| Aktivitas fisik dan skrining aktivitas | Langkah, catat cepat Jalan/Yoga/Sepeda, kalori, target, skrining aktivitas |
| Kondisi pasien | Profil, IMT, data pantau, grafik gula dan tekanan darah, catatan nakes |
| Edukasi mandiri | 10 materi dan kuis 5 soal |
| Ketenangan pikiran bagi keluarga | Bagikan ringkasan ke keluarga via WhatsApp |
| *Tambahan baru* | Akun ID + PIN, rekam medis online, login multi-perangkat, dashboard staf, catatan klinis, ekspor CSV |

Desain visual dibuat versi baru (hijau pinus dan kuning, bukan biru). Menu "Pesan" pada PPT diganti tombol WhatsApp.

## Catatan untuk tesis

1. **Skor skrining risiko** memakai bobot sederhana sebagai contoh; **bukan instrumen tervalidasi**. Ganti dengan instrumen yang Anda sitasi (mis. FINDRISC atau instrumen PERKENI/Kemenkes) di fungsi `hitungSkrining` pada `js/app.js`.
2. **Nilai gizi** di `js/data.js` adalah perkiraan per porsi; sesuaikan dengan TKPI atau ahli gizi.
3. **Ambang gula darah, tekanan darah, dan aturan peringatan dashboard** adalah angka umum. Cocokkan dengan pedoman yang Anda rujuk di `klasGula`, `klasTD` (di `js/app.js` dan `dashboard/dashboard.js`) dan di fungsi `ringkas` pada dashboard.
4. Disarankan uji kebergunaan dengan calon pengguna (mis. SUS) sebelum pengambilan data utama.

## Batasan

- Langkah kaki diisi manual (browser HP tidak bisa membaca sensor langkah secara andal).
- Pengingat obat memakai notifikasi browser dan tidak dijamin berbunyi saat aplikasi tertutup sepenuhnya; sarankan alarm bawaan HP.
- Penyelarasan antarperangkat memakai prinsip "yang terakhir disimpan menang" per catatan.
- Mendaftar dan masuk butuh internet; setelah itu aplikasi bisa dipakai tanpa internet dan menyinkronkan nanti.
- Database yang dipakai adalah Google Sheets. Memindahkan ke database lain (mis. MySQL/Supabase/Firebase) berarti menulis ulang `server/Code.gs`; di luar paket ini.
- Dashboard belum membedakan hak akses antarstaf (semua staf melihat semua pasien).

## Pemecahan masalah

| Gejala | Kemungkinan penyebab |
|---|---|
| Aplikasi tidak menawarkan akun, Profil menulis "belum diaktifkan" | `SYNC_URL` di `js/config.js` kosong atau belum diunggah ulang |
| Dashboard: "Alamat server belum diisi" | Sama seperti di atas |
| "token salah" | `TOKEN` di `config.js` berbeda dari di `Code.gs` |
| Data tidak masuk, tanpa pesan jelas | Deployment belum *Siapa saja*, atau `Code.gs` diubah tanpa membuat versi baru |
| "PIN salah" / "ID tidak ditemukan" | ID/PIN keliru, atau `GARAM` diubah setelah pasien mendaftar |
| "Nama pengguna atau kata sandi salah" di dashboard | Akun staf belum dibuat (Langkah 3), salah ketik, atau `GARAM` diubah |
| "Terlalu banyak percobaan" | Salah 5 kali; tunggu 15 menit |
| Dashboard: "Sesi habis" | Sesi 6 jam berakhir; masuk lagi |
| Antrean tidak berkurang | Tidak ada internet, atau URL salah (harus berakhiran `/exec`) |
| HP tidak memuat versi terbaru | Ubah `VERSI` di `sw.js`, unggah ulang, tutup dan buka lagi aplikasinya |
| Dashboard tampak kosong padahal pasien sudah mendaftar | Pasien belum mengirim catatan, atau persetujuan tidak dicentang (data tetap lokal) |

---
Aplikasi ini alat bantu pencatatan dan edukasi, bukan pengganti pemeriksaan, diagnosis, atau saran dokter. Dalam keadaan darurat, segera ke fasilitas kesehatan terdekat.
