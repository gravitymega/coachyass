@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist .venv (echo Lance d'abord "installer-windows.bat". & pause & exit /b 1)
call .venv\Scripts\activate.bat
set ECH=
for %%f in (ma-voix.*) do set ECH=%%f
if "%ECH%"=="" (echo Mets ton enregistrement dans ce dossier sous le nom "ma-voix" ^(ex. ma-voix.m4a^). & pause & exit /b 1)
python clone.py --echantillon "%ECH%" --texte texte-voix-off.txt --sortie sortie\voix-off.wav
echo.
echo Le resultat est dans le dossier "sortie" ^(voix-off.wav et voix-off.mp3^).
explorer sortie
pause
