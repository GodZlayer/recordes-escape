@echo off
setlocal
cd /d "%~dp0"
title Painel de Recordes - Integracao Canva

where node >nul 2>nul
if errorlevel 1 (
  echo ERRO: Node.js nao foi encontrado.
  pause
  exit /b 1
)

if not exist "canva-app\node_modules" (
  echo Instalando a integracao Canva...
  call npm.cmd --prefix canva-app install
  if errorlevel 1 (
    echo ERRO: Nao foi possivel instalar a integracao.
    pause
    exit /b 1
  )
)

echo.
echo Esta janela controla a integracao Canva.
echo Mantenha-a aberta enquanto estiver usando o editor.
echo Fechar esta janela tambem encerrara os dois servicos.
echo.
echo No Canva Developer Portal, use http://localhost:8080 como Development URL.
echo Nao abra a URL 8080 como uma pagina: ela exibe o bundle JavaScript.
echo A interface aparece pelo botao Preview dentro do Canva.
echo.

node "%~dp0scripts\canva-dev.mjs"
set EXIT_CODE=%ERRORLEVEL%

echo.
if not "%EXIT_CODE%"=="0" echo A integracao foi encerrada com erro %EXIT_CODE%.
echo Todos os servicos Canva foram encerrados.
pause
exit /b %EXIT_CODE%
