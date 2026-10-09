import uvicorn
import logging
from apscheduler.schedulers.background import BackgroundScheduler
from core.database import init_db
from core.sector_analyzer import SectorLeaderAnalyzer

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("MainService")

from datetime import datetime, time

analyzer = SectorLeaderAnalyzer()

def is_trading_time():
    """判断当前是否为 A 股交易工作时间（周一至周五 09:15-11:35, 12:55-15:05）"""
    now = datetime.now()
    # 0=周一, 4=周五, 5/6=周末
    if now.weekday() >= 5:
        return False
    cur_time = now.time()
    morning_start = time(9, 15)
    morning_end = time(11, 35)
    afternoon_start = time(12, 55)
    afternoon_end = time(15, 5)
    return (morning_start <= cur_time <= morning_end) or (afternoon_start <= cur_time <= afternoon_end)

def scheduled_job(force=False):
    if not force and not is_trading_time():
        logger.info("当前非A股盘中交易时段，定时抓取跳过（工作时间 09:15-11:35, 12:55-15:05 自动高频拉取）")
        return
    logger.info("⚡【交易时段/实时分析】开始拉取最新实时盘面并执行龙头多因子分析...")
    try:
        analyzer.refresh_and_save_top20_sectors()
        analyzer.update_dragon_tiger_and_events()
        analyzer.run_guoren_quant_screen()
        logger.info("✔ 实时盘面与龙头分析任务完成，最新数据已落库！")
    except Exception as e:
        logger.error(f"实时数据拉取与分析异常: {e}")

if __name__ == "__main__":
    init_db()
    
    # 启动时立即执行一次，确保启动即拥有今天最新的盘中分析数据
    import threading
    threading.Thread(target=scheduled_job, kwargs={"force": True}, daemon=True).start()
    
    # 启动 APScheduler 定时调度器
    scheduler = BackgroundScheduler()
    # 工作时间每隔 1 分钟检测并更新一次板块与龙头梯队
    scheduler.add_job(scheduled_job, 'interval', minutes=1, id='intraday_pipeline')
    scheduler.start()
    logger.info("APScheduler 工作时间实时监控引擎已启动，工作时间调度周期：1 分钟。")

    # 启动 FastAPI Web 生产服务，运行于 8099 端口
    logger.info("正在启动 A 股全息监控与投研看板，访问地址: http://127.0.0.1:8099")
    uvicorn.run("api.server:app", host="127.0.0.1", port=8099, log_level="info")
