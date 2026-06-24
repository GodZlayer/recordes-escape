@echo off
setlocal

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado. Instale o Node.js e tente novamente.
  pause
  exit /b 1
)

where ffmpeg >nul 2>nul
if errorlevel 1 (
  echo FFmpeg nao encontrado no PATH. Instale o FFmpeg e tente novamente.
  pause
  exit /b 1
)

if not exist "node_modules\playwright-core\package.json" (
  echo Instalando dependencia local playwright-core...
  call npm.cmd install playwright-core@1.49.1 --no-save
  if errorlevel 1 (
    echo Falha ao instalar playwright-core.
    pause
    exit /b 1
  )
)

node "%~dp0scripts\video-manager.mjs"
set EXIT_CODE=%ERRORLEVEL%

if not "%EXIT_CODE%"=="0" (
  echo.
  echo O gerenciador foi encerrado com erro.
  pause
  exit /b %EXIT_CODE%
)

echo.
echo Gerenciador encerrado.
pause
