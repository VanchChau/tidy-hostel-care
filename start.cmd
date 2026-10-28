@echo off
cd /d "%~dp0"
python -c "import flask" >nul 2>&1
if errorlevel 1 (
  echo Installing Tidy's Python dependency...
  python -m pip install -r requirements.txt
  if errorlevel 1 (
    echo Install Python 3.10 or newer, then try again.
    pause
    exit /b 1
  )
)
echo.
echo Open http://127.0.0.1:5000 in your browser.
echo Keep this window open while using Tidy. Press Ctrl+C to stop.
echo.
python app.py
pause
