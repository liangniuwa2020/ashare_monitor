#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
====================================================================
A股市场全息信息收集与监控系统 - 全量数据一键聚合调度引擎
====================================================================
功能说明：
1. 一键触发全市场多源异构金融数据采集流水线（腾讯、新浪、东财、果仁网）。
2. 计算并聚合：
   - 每日强势板块 TOP 20 深度资料与启动时段推断 (分时量能拐点模型)
   - 各板块全部成分股穿透及板块龙1/龙2/龙3梯队量化打分
   - 全市场总龙头(MASTER)、全市场龙1(DRAGON_1)、全市场龙2(DRAGON_2)定位模型
   - 龙虎榜每日机构与游资净买入明细及上榜归因
   - 限售股解禁日程及流通盘变动风控
   - 股吧/雪球社区热度榜与市场多空情绪倾向
   - 果仁网多因子量化选股模型（动量、低波动率、PE分位数、业绩成长、复合得分）
3. 集中事务安全落库至 SQLite (ashare_data.db)，并打印专业控制台投研摘要报表。
4. 支持单次极速聚合 (--once) 或盘中持续自动化轮询 (--loop)。
"""

import os
import sys
import time
import argparse
import logging
from datetime import datetime

# 自动处理 Windows 终端编码，防御 Unicode 异常
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

# 保证项目根目录在 sys.path 首位
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from core.database import init_db, get_connection
from core.sector_analyzer import SectorLeaderAnalyzer
from collectors.tencent import TencentCollector

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("DataAggregator")


def print_banner():
    banner = """
========================================================================================
     __ _       _____ _                     __  __             _ _             
    / _\ |_ ___/ _   / |__   __ _ _ __ ___ |  \/  | ___  _ __ (_) |_ ___  _ __ 
   / /\ \ __/ _ \ / /\/ '_ \ / _` | '__/ _ \| |\/| |/ _ \| '_ \| | __/ _ \| '__|
  / /_ \ \ || (_) / /  | | | | (_| | | |  __/| |  | | (_) | | | | | || (_) | |   
  \____/\__\___/\_/   |_| |_|\__,_|_|  \___||_|  |_|\___/|_| |_|_|\__\___/|_|   
========================================================================================
     A 股全息信息收集与监控系统 - 全量数据一键深度聚合与龙头分析流水线
========================================================================================
    """
    print(banner)


def run_full_aggregation(force=True):
    """执行一次全量数据聚合流程并统计成果"""
    start_time = time.time()
    today_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    logger.info(f"[*] 开始启动全市场全维度金融数据采集与量化聚合流水线... [当前时间: {today_str}]")

    # 1. 确保数据库结构最新
    logger.info("--> [步骤 1/6] 检查与初始化本地时序数据库结构...")
    init_db()

    analyzer = SectorLeaderAnalyzer()
    tencent = TencentCollector()

    # 2. 抓取大盘四大指数宏观全景
    logger.info("--> [步骤 2/6] 采集大盘核心指数 (上证、深成、创业板、科创50) 毫秒级量价快照...")
    index_codes = ["sh000001", "sz399001", "sz399006", "sh000688"]
    index_quotes = tencent.get_realtime_quotes(index_codes)

    # 3. 聚合 Top 20 板块、启动时间段、成分股穿透及龙头梯队
    logger.info("--> [步骤 3/6] 深度挖掘强势板块 TOP 20、计算启动时段拐点并评定板块龙1/2/3...")
    analyzer.refresh_and_save_top20_sectors()

    # 4. 同步龙虎榜席位明细、限售解禁、股吧舆情
    logger.info("--> [步骤 4/6] 同步龙虎榜机构/知名游资席位博弈、解禁日程与社区舆情热度...")
    analyzer.update_dragon_tiger_and_events()

    # 5. 运行果仁网风格多因子量化选股模型
    logger.info("--> [步骤 5/6] 运行果仁网多因子量化模型 (20D/60D动量、低波动、PE历史分位、成长打分)...")
    analyzer.run_guoren_quant_screen()

    # 6. 从本地库统计产出成果并打印报告
    logger.info("--> [步骤 6/6] 生成聚合报告并校验数据完整性...")
    conn = get_connection()
    c = conn.cursor()

    # 统计数据条数
    c.execute("SELECT count(*) FROM sector_daily WHERE trade_date = date('now', 'localtime')")
    cnt_sectors = c.fetchone()[0]

    c.execute("SELECT count(*) FROM sector_stocks WHERE trade_date = date('now', 'localtime')")
    cnt_stocks = c.fetchone()[0]

    c.execute("SELECT leader_type, stock_code, stock_name, sector_name, change_percent FROM market_leaders WHERE trade_date = date('now', 'localtime') ORDER BY id ASC")
    leaders = [dict(r) for r in c.fetchall()]

    c.execute("SELECT security_name, change_rate, billboard_net_amt, explanation FROM dragon_tiger_daily ORDER BY billboard_net_amt DESC LIMIT 5")
    dt_top5 = [dict(r) for r in c.fetchall()]

    c.execute("SELECT stock_code, stock_name, composite_score, momentum_20d, growth_score FROM quant_factors ORDER BY composite_score DESC LIMIT 5")
    quant_top5 = [dict(r) for r in c.fetchall()]

    conn.close()

    elapsed = time.time() - start_time
    logger.info(f"[OK] 全量数据聚合流水线执行完毕！总耗时: {elapsed:.2f} 秒\n")

    # 控制台终端报表
    print("\n" + "=" * 80)
    print("                     [报表] A 股数据聚合与量化分析成果汇总")
    print("=" * 80)

    # 1. 大盘指数概览
    print("【1. 大盘核心基准指数行情】")
    idx_name_map = {"sh000001": "上证指数", "sz399001": "深证成指", "sz399006": "创业板指", "sh000688": "科创50"}
    for code in index_codes:
        q = index_quotes.get(code, {})
        name = idx_name_map.get(code, code)
        price = q.get("current_price", 0.0)
        chg = q.get("change_percent", 0.0)
        amt = q.get("amount", 0.0) / 10000.0 if q.get("amount") else 0.0 # 亿元
        sign = "+" if chg > 0 else ""
        print(f"  · {name:<8} {price:>8.2f}  ({sign}{chg:>6.2f}%)  成交额: {amt:>7.1f} 亿元")

    # 2. 板块与成分股统计
    print(f"\n【2. 强势板块与全量成分股采集统计】")
    print(f"  · 深度解析强势板块数: {cnt_sectors} 个")
    print(f"  · 穿透入库成分股总数: {cnt_stocks} 只 (包含龙1/龙2/龙3、中军与后排跟风标的)")

    # 3. 市场总龙头梯队
    print("\n【3. 全市场最高梯队龙头模型判定】")
    if leaders:
        for ld in leaders:
            tag = "[总龙头]" if ld["leader_type"] == "MASTER" else ("[龙1先锋]" if ld["leader_type"] == "DRAGON_1" else "[龙2中军]")
            print(f"  · {tag:<10}: {ld['stock_name']} ({ld['stock_code']})  所属板块: {ld['sector_name']}  涨跌幅: +{ld['change_percent']}%")
    else:
        print("  · 暂无记录（可能在非交易时段，或待交易开盘后生成）")

    # 4. 龙虎榜净买入 Top 5
    print("\n【4. 龙虎榜机构与知名游资净买入前列标的】")
    if dt_top5:
        for idx, dt in enumerate(dt_top5, 1):
            amt_w = dt["billboard_net_amt"]
            amt_str = f"{amt_w/10000:.2f} 亿元" if abs(amt_w) >= 10000 else f"{amt_w:.1f} 万元"
            print(f"  {idx}. {dt['security_name']:<8} 涨幅: {dt['change_rate']:>6.2f}%  净买入: {amt_str:<12} 原因: {dt['explanation'][:28]}")
    else:
        print("  · 暂无龙虎榜数据")

    # 5. 果仁网多因子量化选股 Top 5
    print("\n【5. 果仁网风格多因子综合评分前 5 标的】")
    if quant_top5:
        for idx, qf in enumerate(quant_top5, 1):
            print(f"  {idx}. {qf['stock_name']} ({qf['stock_code']})  综合打分: {qf['composite_score']:>5.1f}  20日动量: {qf['momentum_20d']:>6.2f}%  成长打分: {qf['growth_score']:>5.1f}")
    else:
        print("  · 暂无量化因子数据")

    print("=" * 80)
    print(f" 数据存储状态: 结构化数据库 ashare_data.db 已更新同步")
    print(f" 投研看板访问: 启动服务后浏览器打开 http://127.0.0.1:8099 即可直观查阅所有维度！")
    print("=" * 80 + "\n")


def is_trading_time():
    """判断当前是否为 A 股交易时间段 (周一至周五 09:15-11:35, 12:55-15:05)"""
    from datetime import time as dt_time
    now = datetime.now()
    if now.weekday() >= 5: # 周六周日
        return False
    cur = now.time()
    return (dt_time(9, 15) <= cur <= dt_time(11, 35)) or (dt_time(12, 55) <= cur <= dt_time(15, 5))


def main():
    parser = argparse.ArgumentParser(description="A股全息信息收集与监控系统 - 一键数据聚合脚本")
    parser.add_argument("--once", action="store_true", default=True, help="立即执行一次全量聚合 (默认)")
    parser.add_argument("--loop", type=int, default=0, help="常驻轮询模式：每隔 N 分钟自动聚合一次 (如 --loop 2)")
    parser.add_argument("--force", action="store_true", default=True, help="强制聚合 (非交易时段亦强制执行)")
    args = parser.parse_args()

    print_banner()

    if args.loop > 0:
        interval_sec = max(60, args.loop * 60)
        logger.info(f"[*] 启动常驻定时聚合流水线模式，轮询间隔: {args.loop} 分钟...")
        while True:
            try:
                if args.force or is_trading_time():
                    run_full_aggregation(force=True)
                else:
                    logger.info("当前非 A 股交易时段，跳过本次拉取。保持守护监听中...")
            except Exception as e:
                logger.error(f"聚合过程中捕获异常: {e}", exc_info=True)
            
            logger.info(f"休眠等待下一次聚合调度 ({args.loop} 分钟后)... 按 Ctrl+C 可退出。")
            time.sleep(interval_sec)
    else:
        run_full_aggregation(force=args.force)


if __name__ == "__main__":
    main()
