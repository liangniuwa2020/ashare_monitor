@echo off
chcp 65001 > nul
cd /d "%~dp0"
if exist .venv\Scripts\python.exe (
    .venv\Scripts\python.exe install_dependencies.py
) else (
    where py >nul 2>nul && py install_dependencies.py || python install_dependencies.py
)
pause
