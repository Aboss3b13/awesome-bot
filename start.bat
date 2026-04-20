@echo off
color 0b
echo ===================================================
echo              AWESOME BOT STARTUP
echo ===================================================
echo.

echo [1/3] Checking if Ollama is running...
ollama --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Ollama is not found or not in PATH! Please install Ollama from https://ollama.com
    pause
    exit /b
)
echo [-] Ollama is installed.

echo.
echo [2/3] Setting up Node.js server...
cd server
if not exist node_modules\ (
    echo [-] Installing dependencies...
    npm install
) else (
    echo [-] Dependencies already installed.
)

echo.
echo [3/3] Starting Awesome Bot Server...
echo [-] Open http://localhost:8787 in your browser.
npm start

pause
