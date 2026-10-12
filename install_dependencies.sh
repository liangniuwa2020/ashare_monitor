#!/usr/bin/env bash
# ====================================================================
# A 股市场全息监控与投研系统 - Linux 一键安装与环境配置脚本
# 支持系统: Ubuntu / Debian / CentOS / RHEL / Fedora / Arch Linux / Alpine
# ====================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "===================================================================="
echo "    A 股市场全息监控与投研系统 - Linux 自动化安装与配置向导"
echo "===================================================================="

# 1. 检查 Python3
if ! command -v python3 &>/dev/null; then
    echo "[!] 未检测到 python3，尝试检测包管理器并提示安装..."
    if command -v apt-get &>/dev/null; then
        echo "  -> 请先执行: sudo apt-get update && sudo apt-get install -y python3 python3-venv python3-pip"
    elif command -v yum &>/dev/null; then
        echo "  -> 请先执行: sudo yum install -y python3 python3-pip"
    elif command -v dnf &>/dev/null; then
        echo "  -> 请先执行: sudo dnf install -y python3 python3-pip"
    elif command -v pacman &>/dev/null; then
        echo "  -> 请先执行: sudo pacman -S python python-pip"
    fi
    exit 1
fi

PYTHON_BIN="$(command -v python3)"
echo "[✔] 找到 Python: $($PYTHON_BIN --version) ($PYTHON_BIN)"

# 2. 检查或创建虚拟环境 (.venv)
VENV_DIR="$SCRIPT_DIR/.venv"
VENV_PYTHON="$VENV_DIR/bin/python"

if [ ! -f "$VENV_PYTHON" ]; then
    echo "[步骤 1/4] 正在创建 Python 虚拟环境 (.venv)..."
    if command -v uv &>/dev/null; then
        echo "  -> 检测到 uv，使用 uv 极速创建虚拟环境..."
        uv venv "$VENV_DIR"
    else
        $PYTHON_BIN -m venv "$VENV_DIR" || {
            echo "[!] 创建 venv 失败，可能缺少 python3-venv。如在 Ubuntu/Debian 请运行: sudo apt-get install -y python3-venv"
            exit 1
        }
    fi
    echo "[✔] 虚拟环境创建成功: $VENV_DIR"
else
    echo "[✔] 已存在虚拟环境: $VENV_DIR"
fi

# 3. 升级 pip 并使用清华源安装依赖包
echo "[步骤 2/4] 安装与同步依赖包 (默认使用清华大学镜像加速)..."
TSINGHUA_INDEX="https://pypi.tuna.tsinghua.edu.cn/simple"
REQ_FILE="$SCRIPT_DIR/requirements.txt"

if command -v uv &>/dev/null; then
    echo "  -> 正在使用 uv 并行极速安装依赖包..."
    uv pip install -r "$REQ_FILE" -i "$TSINGHUA_INDEX" --directory "$SCRIPT_DIR" || {
        echo "  -> uv 安装遇到重试，切换到 pip..."
        "$VENV_PYTHON" -m pip install -r "$REQ_FILE" -i "$TSINGHUA_INDEX"
    }
else
    echo "  -> 正在使用 pip 安装依赖包..."
    "$VENV_PYTHON" -m pip install --upgrade pip -i "$TSINGHUA_INDEX" 2>/dev/null || true
    "$VENV_PYTHON" -m pip install -r "$REQ_FILE" -i "$TSINGHUA_INDEX" || {
        echo "  -> 清华源连接受阻，尝试使用阿里云镜像重试..."
        "$VENV_PYTHON" -m pip install -r "$REQ_FILE" -i "https://mirrors.aliyun.com/pypi/simple"
    }
fi

# 4. 验证关键包导入
echo "[步骤 3/4] 验证核心依赖包完整性..."
"$VENV_PYTHON" -c "import fastapi, uvicorn, requests, pypinyin, apscheduler, pandas, numpy; print('  -> [✔] 核心量化分析与 Web 服务依赖包校验通过！')"

# 5. 赋予启动脚本执行权限
echo "[步骤 4/4] 配置文件与脚本权限..."
chmod +x "$SCRIPT_DIR/run.sh" 2>/dev/null || true
chmod +x "$SCRIPT_DIR/aggregate_data.sh" 2>/dev/null || true
chmod +x "$SCRIPT_DIR/install_dependencies.sh" 2>/dev/null || true

echo "===================================================================="
echo "  🎉 Linux 环境配置完成！"
echo "  启动方式:"
echo "    1. 直接运行: ./run.sh"
echo "    2. 后台运行: nohup ./run.sh > monitor.log 2>&1 &"
echo "    3. 手动数据聚合: ./aggregate_data.sh"
echo "  访问地址: http://<你的Linux服务器IP>:8099"
echo "===================================================================="
