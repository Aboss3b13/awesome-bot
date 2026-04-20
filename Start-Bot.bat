@echo off
color 0A
echo =========================================
echo       STARTING AWESOME BOT IDE
echo =========================================
echo.

echo [1/3] Starting backend Node.js server...
cd server
start "Awesome Bot Server" cmd /c "npm start"

echo [2/3] Waiting for server to initialize...
timeout /t 3 /nobreak >nul

echo [3/3] Opening your default web browser...
start http://localhost:8787

echo.
echo =========================================
echo Starting Cloudflare Tunnel to make it public!
echo =========================================
cd ..
.\cloudflared.exe tunnel --url http://localhost:8787
