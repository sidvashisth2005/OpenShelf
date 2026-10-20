@echo off
rem OpenShelf setup for Windows: double-click or run `setup.cmd` from the repo folder.
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install the LTS version first:
  echo   winget install OpenJS.NodeJS.LTS
  echo or download it from https://nodejs.org, then run setup.cmd again.
  pause
  exit /b 1
)
node scripts\setup.mjs %*
set CODE=%ERRORLEVEL%
if "%~1"=="" pause
exit /b %CODE%
