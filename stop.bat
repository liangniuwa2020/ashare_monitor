@echo off
chcp 65001 > nul
echo ====================================================================
echo        正在停止 A股市场量化监控系统 (释放 8099 端口)...
echo ====================================================================

set found=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8099 " ^| findstr "LISTENING"') do (
    set found=1
    echo [正在终止] 发现后台进程 PID: %%a...
    taskkill /F /PID %%a >nul 2>&1
)

if %found%==0 (
    echo [提示] 未发现正在运行的 8099 监控服务。
) else (
    echo [成功] A股量化监控服务已彻底停止。
)

timeout /t 2 >nul
