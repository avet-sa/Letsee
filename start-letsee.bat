@echo off
echo Starting Letsee Front Office App...
echo.

cd /d "%~dp0"

echo [1/2] Starting PocketBase server...
start "PocketBase Server" pocketbase.exe serve

echo [2/2] Waiting for server to start...
timeout /t 3 /nobreak >nul

echo.
echo ====================================
echo   Letsee is starting!
echo ====================================
echo.
echo PocketBase Admin: http://127.0.0.1:8090/_/
echo Application: Opening in browser...
echo.
echo Press Ctrl+C to stop PocketBase
echo ====================================
echo.

start "" index.html

rem Keep window open to show PocketBase is running
echo PocketBase server is running in a separate window.
echo You can close this window anytime.
pause
