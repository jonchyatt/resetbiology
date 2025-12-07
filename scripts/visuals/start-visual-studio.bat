@echo off
REM ============================================
REM Visual Studio - One-Click Launcher
REM ============================================
REM Double-click this file to start the dev server
REM and automatically open the Visual Studio in your browser.
REM ============================================

setlocal

set "REPO_DIR=C:\Users\jonch\reset-biology-website"
set "URL=http://localhost:3000/visuals/breathing"

echo.
echo  ============================================
echo   Visual Studio - Audio-Reactive Orb Generator
echo  ============================================
echo.
echo  Starting development server...
echo.

cd /d "%REPO_DIR%"

REM Start the browser after a delay (gives server time to start)
start "" cmd /c "timeout /t 8 /nobreak >nul && start %URL%"

REM Start the dev server (this will block until you close it)
npm run dev

echo.
echo  Server stopped. Press any key to close.
pause >nul
