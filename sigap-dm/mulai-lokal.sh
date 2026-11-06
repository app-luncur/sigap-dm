#!/usr/bin/env sh
# Menjalankan SIGAP-DM di komputer macOS/Linux (butuh Python 3). Buka http://localhost:8080 di browser.
cd "$(dirname "$0")"
echo "SIGAP-DM berjalan di http://localhost:8080  (tekan Ctrl+C untuk berhenti)"
python3 -m http.server 8080
