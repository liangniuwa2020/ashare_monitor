#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
====================================================================
A股市场全息信息收集与监控系统 - 一键环境配置与依赖包自动安装器
====================================================================
"""

import os
import sys
import subprocess
import shutil

# 自动处理控制台编码
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
VENV_DIR = os.path.join(BASE_DIR, ".venv")
VENV_PYTHON = os.path.join(VENV_DIR, "Scripts", "python.exe") if os.name == "nt" else os.path.join(VENV_DIR, "bin", "python")
REQ_FILE = os.path.join(BASE_DIR, "requirements.txt")
TSINGHUA_INDEX = "https://pypi.tuna.tsinghua.edu.cn/simple"
ALIYUN_INDEX = "https://mirrors.aliyun.com/pypi/simple"


def main():
    print("=" * 72)
    print("    A 股市场全息监控与投研系统 - 一键依赖包安装与环境配置向导")
    print("=" * 72)
    print()

    # 1. 检查或创建虚拟环境
    print("[步骤 1/4] 检查本地 Python 虚拟环境 (.venv)...")
    if not os.path.exists(VENV_PYTHON):
        print("  -> 本地虚拟环境不存在，正在自动初始化 .venv ...")
        # 优先使用 uv (超轻量秒级创建)
        uv_path = shutil.which("uv")
        created = False
        if uv_path:
            try:
                subprocess.run([uv_path, "venv", VENV_DIR], cwd=BASE_DIR, check=True)
                created = True
                print("  -> [OK] 使用 uv 极速创建虚拟环境成功！")
            except Exception:
                pass
        
        if not created:
            try:
                subprocess.run([sys.executable, "-m", "venv", VENV_DIR], cwd=BASE_DIR, check=True)
                print("  -> [OK] 使用系统 Python 成功创建虚拟环境！")
            except Exception as e:
                print(f"  -> [ERROR] 创建虚拟环境失败: {e}")
                sys.exit(1)
    else:
        print(f"  -> [OK] 已检测到现有虚拟环境: {VENV_DIR}")

    # 2. 安装与同步依赖包
    print("\n[步骤 2/4] 安装与同步依赖包 (默认使用清华大学 PyPI 高速镜像源)...")
    uv_path = shutil.which("uv")
    installed = False

    if uv_path:
        print("  -> 正在使用 uv 并行极速安装依赖包...")
        try:
            cmd = [uv_path, "pip", "install", "-r", REQ_FILE, "-i", TSINGHUA_INDEX, "--directory", BASE_DIR]
            res = subprocess.run(cmd, cwd=BASE_DIR)
            if res.returncode == 0:
                installed = True
                print("  -> [OK] uv 极速安装依赖包全部完成！")
        except Exception:
            pass

    if not installed:
        print("  -> 正在使用 pip 安装依赖包...")
        try:
            # 确保 pip 组件存在
            subprocess.run([VENV_PYTHON, "-m", "ensurepip", "--default-pip"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            # 安装依赖
            cmd = [VENV_PYTHON, "-m", "pip", "install", "-r", REQ_FILE, "-i", TSINGHUA_INDEX]
            res = subprocess.run(cmd, cwd=BASE_DIR)
            if res.returncode != 0:
                print("  -> 清华镜像连接受阻，自动切换阿里云镜像重试...")
                cmd_ali = [VENV_PYTHON, "-m", "pip", "install", "-r", REQ_FILE, "-i", ALIYUN_INDEX]
                res_ali = subprocess.run(cmd_ali, cwd=BASE_DIR)
                if res_ali.returncode == 0:
                    installed = True
            else:
                installed = True
        except Exception as e:
            print(f"  -> [ERROR] pip 安装异常: {e}")

    # 3. 验证关键包导入
    print("\n[步骤 3/4] 验证核心量化与 Web 依赖包完整性...")
    verify_script = "import fastapi, uvicorn, requests, pypinyin, apscheduler, pandas, numpy; print('  -> [OK] fastapi, uvicorn, requests, pypinyin, apscheduler, pandas, numpy 校验通过！')"
    res_verify = subprocess.run([VENV_PYTHON, "-c", verify_script], cwd=BASE_DIR)

    if res_verify.returncode == 0:
        print("\n" + "=" * 72)
        print("[步骤 4/4] 恭喜！A 股全息监控系统所有环境与依赖包已成功就绪！")
        print()
        print("后续操作提示：")
        print("  1. 立即执行数据聚合: 双击运行 [aggregate_data.bat]")
        print("  2. 启动系统投研看板: 双击运行 [run.bat] (访问 http://127.0.0.1:8099)")
        print("=" * 72 + "\n")
    else:
        print("\n[ERROR] 核心依赖包自检未完全通过，请检查上方日志！")
        sys.exit(1)


if __name__ == "__main__":
    main()
