@echo off
title ElettroOre - Gestione Ore
cd /d "%~dp0"
echo ==============================================
echo       Avvio ElettroOre / تشغيل البرنامج       
echo ==============================================
echo.
start "" http://localhost:3000
npm run dev
pause
