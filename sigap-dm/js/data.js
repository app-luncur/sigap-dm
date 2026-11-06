/* SIGAP-DM — konten statis (ikon, makanan, resep, edukasi, kuis) */
window.SIGAP = (() => {
  const P = d => `<path d="${d}"/>`;

  const ICONS = {
    home: P('M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'),
    pasien: P('M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2') + '<circle cx="9" cy="7" r="4"/>' + P('M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75'),
    data: P('M3 3v18h18M7 15l4-4 3 3 5-6'),
    book: P('M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z'),
    user: P('M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2') + '<circle cx="12" cy="7" r="4"/>',
    plus: P('M12 5v14M5 12h14'),
    drop: P('M12 2.7s6 6.3 6 11a6 6 0 0 1-12 0c0-4.7 6-11 6-11z'),
    pill: P('m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7zM8.5 8.5l7 7'),
    fork: P('M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7'),
    flame: P('M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z'),
    pulse: P('M22 12h-4l-3 9L9 3l-3 9H2'),
    clip: P('M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2') + '<rect x="8" y="2" width="8" height="4" rx="1"/>' + P('m9 14 2 2 4-4'),
    bell: P('M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0'),
    chev: P('m9 18 6-6-6-6'),
    chevL: P('m15 18-6-6 6-6'),
    trash: P('M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6'),
    check: P('M20 6 9 17l-5-5'),
    share: P('M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v14'),
    download: P('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3'),
    print: P('M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z'),
    x: P('M18 6 6 18M6 6l12 12'),
    chat: P('M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'),
    scale: P('M12 3v18M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z'),
    foot: P('M4 16c0-3 1.5-5 3-5s2 2 2 4-1 4-3 4-2-1-2-3zM14 9c0-3 1.5-6 3.5-6S21 6 21 9s-1.5 5-3.5 5S14 12 14 9z')
  };

  // [nama, ukuran porsi, karbohidrat g, protein g, lemak g] — nilai PERKIRAAN per porsi
  const FOODS = [
    ['Nasi putih', '1 centong (±100 g)', 40, 3, 0.3],
    ['Nasi merah', '1 centong (±100 g)', 33, 3, 1],
    ['Bubur nasi', '1 mangkuk kecil', 25, 2, 0.5],
    ['Lontong', '1 potong (±100 g)', 26, 2, 0.3],
    ['Roti tawar', '1 lembar', 12, 2, 1],
    ['Kentang rebus', '1 buah sedang (±100 g)', 20, 2, 0.1],
    ['Ubi rebus', '1 buah sedang (±100 g)', 27, 1.5, 0.2],
    ['Singkong rebus', '1 potong (±100 g)', 36, 1, 0.3],
    ['Nasi goreng', '1 piring (±200 g)', 48, 8, 12],
    ['Mi goreng', '1 porsi', 54, 8, 14],
    ['Telur rebus', '1 butir', 0.6, 6.5, 5],
    ['Ayam bakar tanpa kulit', '1 potong sedang', 0, 17, 4],
    ['Ikan panggang', '1 potong sedang (±50 g)', 0, 11, 4],
    ['Pepes ikan', '1 bungkus', 2, 12, 5],
    ['Tempe goreng', '2 potong sedang', 6, 9, 11],
    ['Tahu rebus/kukus', '1 potong sedang', 1, 4, 2.5],
    ['Sayur bening bayam', '1 mangkuk', 4, 2, 0.3],
    ['Tumis kangkung', '1 porsi (±100 g)', 4, 2, 4],
    ['Sayur asem', '1 mangkuk', 8, 2, 1],
    ['Gado-gado', '1 porsi', 30, 12, 16],
    ['Soto ayam (tanpa nasi)', '1 mangkuk', 10, 15, 8],
    ['Gorengan (bakwan/tahu isi)', '1 buah', 10, 2, 7],
    ['Pisang', '1 buah sedang', 16, 1, 0.3],
    ['Pepaya', '1 potong sedang (±100 g)', 10, 0.5, 0.1],
    ['Apel', '1 buah kecil', 14, 0.3, 0.4],
    ['Jeruk', '1 buah', 12, 1, 0.2],
    ['Semangka', '1 potong (±100 g)', 8, 0.6, 0.2],
    ['Teh manis', '1 gelas (2 sdm gula)', 24, 0, 0],
    ['Susu', '1 gelas (200 ml)', 10, 6, 6.5],
    ['Teh tawar / air putih', '1 gelas', 0, 0, 0]
  ];

  const RECIPES = [
    {
      t: 'Pepes ikan kembung',
      info: 'Tanpa digoreng, kaya protein.',
      bahan: ['2 ekor ikan kembung, bersihkan', 'Daun kemangi, tomat, cabai, bawang merah & putih, kunyit', 'Daun pisang untuk membungkus'],
      langkah: ['Haluskan bawang, cabai, dan kunyit; lumuri ke ikan.', 'Bungkus ikan bersama tomat dan kemangi dengan daun pisang.', 'Kukus 25–30 menit sampai matang.']
    },
    {
      t: 'Sayur bening bayam jagung',
      info: 'Rendah lemak, banyak serat.',
      bahan: ['2 ikat bayam', '1 buah jagung manis, serut', 'Bawang putih, bawang merah, sedikit garam'],
      langkah: ['Rebus air dengan bawang yang digeprek.', 'Masukkan jagung, masak sampai empuk.', 'Masukkan bayam, angkat setelah layu. Beri garam secukupnya.']
    },
    {
      t: 'Tumis kangkung tempe',
      info: 'Minyak hanya 1 sendok makan.',
      bahan: ['1 ikat kangkung', '1 papan kecil tempe, potong dadu', 'Bawang putih, cabai, 1 sdm minyak'],
      langkah: ['Panggang atau tumis tempe di wajan antilengket sampai kecokelatan.', 'Tumis bawang putih dan cabai dengan sedikit minyak.', 'Masukkan kangkung dan tempe, aduk 2–3 menit. Jangan terlalu matang.']
    },
    {
      t: 'Pecel sayur',
      info: 'Bumbu kacang secukupnya saja.',
      bahan: ['Bayam, kacang panjang, tauge, kol — rebus', '2 sdm bumbu kacang (kurangi gula merah)', 'Tahu atau tempe kukus'],
      langkah: ['Rebus sayuran sebentar agar tetap renyah.', 'Encerkan bumbu kacang dengan air hangat.', 'Tata sayur dan tahu/tempe, siram bumbu secukupnya.']
    },
    {
      t: 'Sup ayam sayur',
      info: 'Tanpa santan, tanpa kulit ayam.',
      bahan: ['150 g dada ayam tanpa kulit', 'Wortel, buncis, kentang kecil, seledri', 'Bawang putih, lada, garam sedikit'],
      langkah: ['Rebus ayam dengan bawang putih sampai kaldu keluar.', 'Masukkan wortel, kentang, lalu buncis.', 'Bumbui, taburi seledri. Sajikan tanpa gorengan bawang.']
    }
  ];

  const EDU = [
    {
      t: 'Apa itu diabetes melitus?',
      h: `<p>Diabetes melitus (DM) adalah kondisi ketika kadar gula dalam darah tinggi karena tubuh kekurangan atau tidak dapat memakai insulin dengan baik. Insulin adalah hormon yang membantu gula masuk ke dalam sel sebagai energi.</p>
          <p>DM tidak bisa dihilangkan begitu saja, tetapi bisa dikendalikan dengan makan teratur, aktif bergerak, minum obat sesuai anjuran, dan kontrol rutin.</p>`
    },
    {
      t: 'Gejala yang perlu dikenali',
      h: `<ul><li>Sering buang air kecil, terutama malam hari</li><li>Sering haus dan sering lapar</li><li>Berat badan turun tanpa sebab jelas</li><li>Mudah lelah dan pandangan kabur</li><li>Luka sulit sembuh, kaki kesemutan atau baal</li></ul>
          <p>Gejala ini tidak selalu muncul. Karena itu, pemeriksaan gula darah rutin tetap penting.</p>`
    },
    {
      t: 'Berapa target gula darah?',
      h: `<p>Sebagai gambaran umum untuk orang dewasa dengan DM:</p>
          <ul><li>Gula darah puasa: 80–130 mg/dL</li><li>2 jam setelah makan: di bawah 180 mg/dL</li></ul>
          <p>Target tiap orang bisa berbeda. Tanyakan target pribadi Anda kepada dokter atau perawat.</p>`
    },
    {
      t: 'Gula darah rendah (hipoglikemia)',
      h: `<p><b>Gula darah di bawah 70 mg/dL.</b> Tanda: gemetar, keringat dingin, lapar mendadak, pusing, jantung berdebar, sulit konsentrasi.</p>
          <p>Jika masih sadar: minum ½ gelas teh manis atau jus buah (sekitar 15 gram gula), tunggu 15 menit, lalu cek lagi. Ulangi bila masih di bawah 70, lalu makan makanan yang mengenyangkan.</p>
          <p>Jika tidak sadar atau tidak bisa menelan, jangan beri makan atau minum. Segera bawa ke fasilitas kesehatan.</p>`
    },
    {
      t: 'Gula darah sangat tinggi: tanda bahaya',
      h: `<p>Segera ke IGD jika gula darah tinggi disertai mual atau muntah, napas cepat dan dalam, perut nyeri, lemas berat, sangat haus, atau kebingungan.</p>
          <p>Jika angka tinggi terus berulang walaupun sudah patuh, hubungi tenaga kesehatan. Jangan mengubah dosis obat sendiri.</p>`
    },
    {
      t: 'Isi piringku',
      h: `<ul><li>½ piring: sayur (dan sedikit buah di luar piring)</li><li>¼ piring: lauk protein, pilih yang dikukus, direbus, atau dipanggang</li><li>¼ piring: karbohidrat, pilih nasi merah, ubi, atau jagung</li></ul>
          <p>Batasi minuman manis, gorengan, dan makanan asin. Minum air putih. Makan teratur, jangan melewatkan sarapan.</p>`
    },
    {
      t: 'Aktivitas fisik',
      h: `<p>Targetkan sekitar 150 menit per minggu, misalnya jalan cepat 30 menit, 5 kali seminggu. Jangan libur lebih dari 2 hari berturut-turut.</p>
          <p>Mulai pelan dan tambah bertahap. Pakai alas kaki yang nyaman, bawa air minum, dan hentikan latihan jika pusing, nyeri dada, atau sesak.</p>`
    },
    {
      t: 'Perawatan kaki',
      h: `<ul><li>Periksa kedua kaki setiap hari: luka, lepuh, kemerahan, retak</li><li>Cuci dengan air suam-suam kuku, keringkan sela jari</li><li>Pakai pelembap (jangan di sela jari)</li><li>Jangan berjalan tanpa alas kaki, pilih sepatu yang pas</li><li>Potong kuku lurus, jangan terlalu pendek</li></ul>
          <p>Luka kecil yang tidak membaik dalam beberapa hari perlu diperiksa ke fasilitas kesehatan.</p>`
    },
    {
      t: 'Disiplin minum obat',
      h: `<p>Minum obat pada jam yang sama setiap hari. Jangan berhenti atau mengubah dosis tanpa bertanya kepada dokter, walaupun gula darah sudah bagus.</p>
          <p>Jika lupa minum, tanyakan kepada apoteker atau dokter apa yang sebaiknya dilakukan. Jangan menggandakan dosis sendiri. Bawa catatan di aplikasi ini saat kontrol.</p>`
    },
    {
      t: 'Kapan harus ke fasilitas kesehatan?',
      h: `<ul><li>Gula darah di bawah 70 yang tidak membaik, atau pingsan</li><li>Gula darah di atas 300, atau tinggi dengan mual, muntah, napas cepat</li><li>Luka di kaki yang tidak sembuh, bengkak, atau berbau</li><li>Nyeri dada, sesak napas, lemah satu sisi tubuh, bicara pelo</li><li>Jadwal kontrol rutin sesuai anjuran dokter</li></ul>`
    }
  ];

  const QUIZ = [
    { q: 'Gula darah di bawah 70 mg/dL disebut…', o: ['Hiperglikemia', 'Hipoglikemia', 'Normal', 'Prediabetes'], a: 1 },
    { q: 'Jika gula darah rendah dan Anda masih sadar, tindakan pertama yang tepat adalah…', o: ['Tidur dulu', 'Minum teh manis atau jus', 'Olahraga', 'Menambah dosis obat'], a: 1 },
    { q: 'Bagian terbesar pada piring makan sebaiknya diisi…', o: ['Nasi', 'Lauk goreng', 'Sayur', 'Minuman manis'], a: 2 },
    { q: 'Aktivitas fisik yang dianjurkan kira-kira…', o: ['150 menit per minggu', '10 menit per bulan', 'Hanya saat gula tinggi', 'Tidak perlu jika minum obat'], a: 0 },
    { q: 'Luka kecil di kaki yang tidak sembuh beberapa hari sebaiknya…', o: ['Dibiarkan', 'Diberi minyak', 'Diperiksa di fasilitas kesehatan', 'Ditutup tanpa dibersihkan'], a: 2 }
  ];

  return { ICONS, FOODS, RECIPES, EDU, QUIZ };
})();
