@echo off
:: Self-elevate to Administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo ========================================================
echo   Installing ESP32 CP2102 Driver for Windows...
echo ========================================================
echo.

pnputil /add-driver "%~dp0backend\cp210x\silabser.inf" /install

echo.
echo ========================================================
echo   Done! Your ESP32 COM port is now ready.
echo   You can close this window.
echo ========================================================
pause

