@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo === Installation du clonage de voix (Windows) ===

where ffmpeg >nul 2>nul || winget install -e --id Gyan.FFmpeg --accept-source-agreements --accept-package-agreements
py -3.11 --version >nul 2>nul || winget install -e --id Python.Python.3.11 --accept-source-agreements --accept-package-agreements

echo.
echo Si Python ou ffmpeg viennent d'etre installes, FERME cette fenetre et relance ce fichier une fois.
py -3.11 --version >nul 2>nul || (echo Python 3.11 introuvable. Relance ce fichier. & pause & exit /b 1)

if not exist .venv py -3.11 -m venv .venv
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt || (echo L'installation a echoue. & pause & exit /b 1)

echo.
echo Installation terminee.
echo Etape suivante : mets ton enregistrement dans ce dossier sous le nom "ma-voix" (ma-voix.m4a, ma-voix.wav ou ma-voix.mp3),
echo puis double-clique sur "cloner-windows.bat".
pause
