#!/usr/bin/env bash
# ====================================================================
# A 股市场全息监控与投研系统 - Linux 一键手动数据全量聚合脚本
# ====================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

VENV_PYTHON="$SCRIPT_DIR/.venv/bin/python"

if [ ! -f "$VENV_PYTHON" ]; then
    echo "[!] 未检测到虚拟环境 $VENV_PYTHON，正在先执行安装..."
    bash "$SCRIPT_DIR/install_dependencies.sh"
fi

echo "===================================================================="
echo "      正在执行 A 股全市场大盘与板块龙头全量数据聚合入库 (Linux)..."
echo "===================================================================="

exec "$VENV_PYTHON" aggregate_data.py --force "$@"
