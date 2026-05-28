@echo off
cd /d "%~dp0"
echo Starting Autocorrect Studio...
echo.
echo Keep this window open while using the app.
echo Open: http://127.0.0.1:3000
echo.
start "" "http://127.0.0.1:3000"
"C:\Program Files\nodejs\node.exe" server.js
pause
