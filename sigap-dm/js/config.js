/* Pengaturan koneksi ke spreadsheet online (rekam medis sederhana).
   Isi SYNC_URL dan TOKEN setelah Anda memasang server Google Apps Script (lihat README, bagian 3).
   Kosongkan SYNC_URL ('') bila ingin aplikasi berjalan lokal saja tanpa mengirim data. */
window.SIGAP_CONFIG = {
  SYNC_URL: 'https://script.google.com/macros/s/AKfycbyk1y5Ro06MeMkFlWqMsWLveQRMCiVQfKywCRUto81G3MupDDS2jrOkjAjEPGCqOP-S/exec',   // contoh: 'https://script.google.com/macros/s/AKfycb.../exec'
  TOKEN: 'SIGAPDM'       // harus sama persis dengan TOKEN di server/Code.gs
};
