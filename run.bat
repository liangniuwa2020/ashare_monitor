@echo off
chcp 65001 > nul
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

echo 正在启动后台服务与数据监控引擎 (端口: 8099)...
start http://127.0.0.1:8099
".venv\Scripts\python.exe" main.py

pause
