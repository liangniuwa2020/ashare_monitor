@echo off
chcp 65001 > nul
cd /d "%~dp0"
if exist .venv\Scripts\python.exe (
    .venv\Scripts\python.exe aggregate_data.py --force
) else (
    where py >nul 2>nul && py aggregate_data.py --force || python aggregate_data.py --force
)
pause
