@echo off
setlocal

cd /d "%~dp0"

echo Verificando requisitos do Painel de Recordes...
echo.

echo [1/5] Verificando Node.js...
call :find_node

if not defined NODE_EXECUTABLE (
  echo Node.js nao encontrado. Tentando instalar automaticamente...
  call :find_winget
  if not defined WINGET_EXECUTABLE (
    echo ERRO: Node.js nao esta instalado e o winget nao foi encontrado.
    echo Instale o App Installer da Microsoft ou o Node.js 18 ou superior.
    pause
    exit /b 1
  )

  "%WINGET_EXECUTABLE%" install --id OpenJS.NodeJS.LTS --exact --silent --accept-package-agreements --accept-source-agreements
  if errorlevel 1 (
    echo ERRO: Nao foi possivel instalar o Node.js automaticamente.
    pause
    exit /b 1
  )
  call :find_node
)

if not defined NODE_EXECUTABLE (
  echo ERRO: O Node.js foi instalado, mas o executavel nao foi localizado.
  echo Reinicie o Windows e execute o painel novamente.
  pause
  exit /b 1
)

if not defined NODE_IN_PATH (
  for %%D in ("%NODE_EXECUTABLE%") do call :add_to_user_path "%%~dpD"
  echo PATH corrigido para o Node.js.
)

for /f "tokens=1 delims=." %%V in ('node -p "process.versions.node"') do set "NODE_MAJOR=%%V"
if %NODE_MAJOR% LSS 18 (
  echo ERRO: Node.js muito antigo. Versao encontrada:
  node --version
  echo Instale o Node.js 18 ou superior.
  pause
  exit /b 1
)
echo Node.js:
node --version

echo.
echo [2/5] Verificando npm...
where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo npm nao encontrado. Tentando reparar a instalacao do Node.js...
  call :find_winget
  if not defined WINGET_EXECUTABLE (
    echo ERRO: npm nao encontrado e o winget nao esta disponivel para o reparo.
    pause
    exit /b 1
  )

  "%WINGET_EXECUTABLE%" install --id OpenJS.NodeJS.LTS --exact --force --silent --accept-package-agreements --accept-source-agreements
  if errorlevel 1 (
    echo ERRO: Nao foi possivel reparar o Node.js/npm.
    pause
    exit /b 1
  )

  call :find_node
  if defined NODE_EXECUTABLE for %%D in ("%NODE_EXECUTABLE%") do call :add_to_user_path "%%~dpD"
  where npm.cmd >nul 2>nul
  if errorlevel 1 (
    echo ERRO: npm continua indisponivel. Reinicie o Windows e tente novamente.
    pause
    exit /b 1
  )
)
echo npm:
call npm.cmd --version

echo.
echo [3/5] Verificando FFmpeg...
call :find_ffmpeg

if not defined FFMPEG_EXECUTABLE (
  echo FFmpeg nao encontrado. Tentando instalar automaticamente...
  call :find_winget
  if not defined WINGET_EXECUTABLE (
    echo ERRO: FFmpeg nao esta instalado e o winget nao foi encontrado.
    echo Instale o App Installer da Microsoft ou instale o FFmpeg manualmente.
    pause
    exit /b 1
  )

  "%WINGET_EXECUTABLE%" install --id Gyan.FFmpeg --exact --silent --accept-package-agreements --accept-source-agreements
  if errorlevel 1 (
    echo ERRO: Nao foi possivel instalar o FFmpeg automaticamente.
    pause
    exit /b 1
  )
  call :find_ffmpeg
)

if not defined FFMPEG_EXECUTABLE (
  echo ERRO: O FFmpeg foi instalado, mas o executavel nao foi localizado.
  echo Reinicie o Windows e execute o painel novamente.
  pause
  exit /b 1
)

if not defined FFMPEG_IN_PATH (
  for %%D in ("%FFMPEG_EXECUTABLE%") do call :add_to_user_path "%%~dpD"
  echo PATH corrigido para o FFmpeg.
)
echo FFmpeg: %FFMPEG_EXECUTABLE%

echo.
echo [4/5] Verificando Chrome ou Edge...
set "BROWSER_EXECUTABLE="

if defined CHROME_PATH (
  if exist "%CHROME_PATH%" (
    set "BROWSER_EXECUTABLE=%CHROME_PATH%"
  ) else (
    echo AVISO: CHROME_PATH esta definida, mas o arquivo nao existe:
    echo %CHROME_PATH%
  )
)

if not defined BROWSER_EXECUTABLE if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "BROWSER_EXECUTABLE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER_EXECUTABLE if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "BROWSER_EXECUTABLE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER_EXECUTABLE if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "BROWSER_EXECUTABLE=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER_EXECUTABLE if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "BROWSER_EXECUTABLE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER_EXECUTABLE if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "BROWSER_EXECUTABLE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER_EXECUTABLE if exist "%LocalAppData%\Microsoft\Edge\Application\msedge.exe" set "BROWSER_EXECUTABLE=%LocalAppData%\Microsoft\Edge\Application\msedge.exe"

if not defined BROWSER_EXECUTABLE (
  echo ERRO: Google Chrome ou Microsoft Edge nao encontrado.
  echo Instale um deles ou defina a variavel CHROME_PATH com o caminho do executavel.
  pause
  exit /b 1
)
echo Navegador: %BROWSER_EXECUTABLE%

echo.
echo [5/5] Verificando Playwright e Potrace...
node -e "const p=require('./package.json'); for(const [n,v] of Object.entries(p.dependencies)){try{if(require(n+'/package.json').version!==v)process.exit(1)}catch{process.exit(1)}}" >nul 2>nul
if errorlevel 1 (
  echo Dependencias ausentes, corrompidas ou em versoes incorretas.
  echo Limpando a instalacao local antes de reinstalar...
  if exist "node_modules" rmdir /s /q "node_modules"
  call npm.cmd install --no-audit --no-fund
  if errorlevel 1 (
    echo ERRO: Falha ao instalar Playwright e Potrace.
    echo Confira a conexao com a internet e tente novamente.
    pause
    exit /b 1
  )
  echo Dependencias instaladas com sucesso.
) else (
  echo Playwright e Potrace ja estao instalados. Nenhuma instalacao necessaria.
)

node -e "const p=require('./package.json'); for(const [n,v] of Object.entries(p.dependencies)){if(require(n+'/package.json').version!==v)process.exit(1)} require('playwright-core'); require('potrace')" >nul 2>nul
if errorlevel 1 (
  echo ERRO: As dependencias foram encontradas, mas nao puderam ser carregadas.
  echo Exclua a pasta node_modules e execute o painel novamente.
  pause
  exit /b 1
)

echo.
echo Todos os requisitos foram verificados com sucesso.
echo.

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
exit /b 0

:find_node
set "NODE_EXECUTABLE="
set "NODE_IN_PATH="
for /f "delims=" %%F in ('where node 2^>nul') do if not defined NODE_EXECUTABLE (
  set "NODE_EXECUTABLE=%%F"
  set "NODE_IN_PATH=1"
)
if defined NODE_EXECUTABLE exit /b 0

for %%F in (
  "%ProgramFiles%\nodejs\node.exe"
  "%LocalAppData%\Programs\nodejs\node.exe"
  "%ProgramData%\chocolatey\bin\node.exe"
  "%UserProfile%\scoop\apps\nodejs-lts\current\node.exe"
) do if not defined NODE_EXECUTABLE if exist "%%~fF" set "NODE_EXECUTABLE=%%~fF"
exit /b 0

:find_ffmpeg
set "FFMPEG_EXECUTABLE="
set "FFMPEG_IN_PATH="
for /f "delims=" %%F in ('where ffmpeg 2^>nul') do if not defined FFMPEG_EXECUTABLE (
  set "FFMPEG_EXECUTABLE=%%F"
  set "FFMPEG_IN_PATH=1"
)
if defined FFMPEG_EXECUTABLE exit /b 0

for %%F in (
  "%ProgramFiles%\ffmpeg\bin\ffmpeg.exe"
  "%LocalAppData%\Programs\ffmpeg\bin\ffmpeg.exe"
  "%ProgramData%\chocolatey\bin\ffmpeg.exe"
  "%UserProfile%\scoop\shims\ffmpeg.exe"
  "C:\ffmpeg\bin\ffmpeg.exe"
) do if not defined FFMPEG_EXECUTABLE if exist "%%~fF" set "FFMPEG_EXECUTABLE=%%~fF"

if not defined FFMPEG_EXECUTABLE if exist "%LocalAppData%\Microsoft\WinGet\Packages" (
  for /f "delims=" %%F in ('where /r "%LocalAppData%\Microsoft\WinGet\Packages" ffmpeg.exe 2^>nul') do if not defined FFMPEG_EXECUTABLE set "FFMPEG_EXECUTABLE=%%F"
)
exit /b 0

:find_winget
set "WINGET_EXECUTABLE="
for /f "delims=" %%F in ('where winget 2^>nul') do if not defined WINGET_EXECUTABLE set "WINGET_EXECUTABLE=%%F"
if not defined WINGET_EXECUTABLE if exist "%LocalAppData%\Microsoft\WindowsApps\winget.exe" set "WINGET_EXECUTABLE=%LocalAppData%\Microsoft\WindowsApps\winget.exe"
exit /b 0

:add_to_user_path
set "DIRECTORY_TO_ADD=%~1"
set "PATH=%DIRECTORY_TO_ADD%;%PATH%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$d=$env:DIRECTORY_TO_ADD.TrimEnd('\'); $p=[Environment]::GetEnvironmentVariable('Path','User'); if (-not $p) {$p=''}; $parts=@($p -split ';' | ForEach-Object {$_.TrimEnd('\')}); if ($parts -notcontains $d) {[Environment]::SetEnvironmentVariable('Path', (($p.TrimEnd(';') + ';' + $d).Trim(';')), 'User')}" >nul 2>nul
if errorlevel 1 echo AVISO: O PATH foi corrigido nesta execucao, mas nao pode ser salvo permanentemente.
exit /b 0
