@echo off
cd /d "%~dp0"
echo Opening Autocorrect Studio directly from:
echo %cd%\index.html
echo.
start "" "%cd%\index.html"
echo If the browser did not open, copy this path into Chrome:
echo %cd%\index.html
echo.
pause
