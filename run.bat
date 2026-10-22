@echo off
chcp 65001 > nul
title A股市场量化监控系统

echo ====================================================================
echo      A 股市场全息信息收集与监控系统 - 量化龙头作战看板
echo ====================================================================
echo 正在检查 Python 运行环境...

if not exist ".venv\Scripts\python.exe" (
    echo [提示] 虚拟环境不存在，正在自动执行一键安装...
    call install_dependencies.bat
    if not exist ".venv\Scripts\python.exe" (
        echo [ERROR] 依赖安装失败，请检查错误提示！
        pause
        exit /b 1
    )
)

echo 正在检查 8099 端口占用情况...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8099 " ^| findstr "LISTENING"') do (
    echo [检测到旧进程] 正在释放被占用的 8099 端口 (PID: %%a)...
    taskkill /F /PID %%a >nul 2>&1
)

:: 等待端口彻底释放
timeout /t 1 /nobreak >nul

echo 正在启动后台服务与数据监控引擎 (端口: 8099)...
start http://127.0.0.1:8099
".venv\Scripts\python.exe" main.py

pause
