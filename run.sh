#!/usr/bin/env bash
# ====================================================================
# A 股市场全息监控与投研系统 - Linux 一键启动看板服务
# ====================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

VENV_PYTHON="$SCRIPT_DIR/.venv/bin/python"

if [ ! -f "$VENV_PYTHON" ]; then
    echo "[!] 未检测到虚拟环境 $VENV_PYTHON，正在自动执行环境安装向导..."
    bash "$SCRIPT_DIR/install_dependencies.sh"
fi

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8099}"

echo "===================================================================="
echo "      A 股市场全息信息收集与监控系统 - 量化龙头作战看板 (Linux 版)"
echo "===================================================================="
echo "  服务监听地址: http://$HOST:$PORT"
echo "  本地访问:     http://127.0.0.1:$PORT"
echo "===================================================================="

# 如果系统有图形界面和 xdg-open，可在后台尝试打开浏览器
if [ -n "$DISPLAY" ] && command -v xdg-open &>/dev/null; then
    (sleep 1.5 && xdg-open "http://127.0.0.1:$PORT" 2>/dev/null &)
fi

exec "$VENV_PYTHON" main.py
