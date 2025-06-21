@echo off
echo === Quack-Ext Dependency Setup ===
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed or not in PATH
    echo Please install Python from https://python.org
    pause
    exit /b 1
)

REM Check if pip is installed
pip --version >nul 2>&1
if errorlevel 1 (
    echo Error: pip is not installed or not in PATH
    pause
    exit /b 1
)

echo Installing required packages...
echo.

REM Install mitmproxy
echo Installing mitmproxy...
pip install mitmproxy
if errorlevel 1 (
    echo Failed to install mitmproxy
    pause
    exit /b 1
)

REM Install pytesseract
echo Installing pytesseract...
pip install pytesseract
if errorlevel 1 (
    echo Failed to install pytesseract
    pause
    exit /b 1
)

echo.
echo All dependencies installed successfully!
echo Quack-Ext is ready to use.
echo.
pause
