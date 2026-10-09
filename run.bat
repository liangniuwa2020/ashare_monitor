@echo off
chcp 65001 > nul
echo ====================================================================
echo      A 股市场全息信息收集与监控系统 - 量化龙头作战看板
echo ====================================================================
echo 正在检查 Python 运行环境...

if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] 虚拟环境不存在，请先配置 .venv！
    pause
    exit /b
)

echo 正在启动后台服务与数据监控引擎 (端口: 8099)...
start http://127.0.0.1:8099
".venv\Scripts\python.exe" main.py

pause
