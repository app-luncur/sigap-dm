@echo off
REM Menjalankan SIGAP-DM di komputer Windows (butuh Python). Buka http://localhost:8080 di browser.
cd /d "%~dp0"
echo SIGAP-DM berjalan di http://localhost:8080  (tekan Ctrl+C untuk berhenti)
start "" http://localhost:8080
python -m http.server 8080
