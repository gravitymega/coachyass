@echo off
rem Lance le jeu sur cet ordinateur (gratuit, sans Internet, rien a installer). Double-clic.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0outils\serveur.ps1"
pause
