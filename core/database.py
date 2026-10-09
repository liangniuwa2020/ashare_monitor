import sqlite3
import os
import json
import logging
from datetime import datetime

logger = logging.getLogger("Database")
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "ashare_data.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA busy_timeout=30000;")
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    # 1. 行业板块日频/快照表 (Top 20 板块)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sector_daily (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trade_date TEXT,
        rank_num INTEGER,
        sector_code TEXT,
        sector_name TEXT,
        change_percent REAL,
        turnover_amount REAL,
        avg_price REAL,
        leader_code TEXT,
        leader_name TEXT,
        leader_change REAL,
        launch_period TEXT,
        launch_reason TEXT,
        score REAL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # 2. 板块成分股与梯度龙头表 (板块龙1、龙2、龙3)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sector_stocks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trade_date TEXT,
        sector_code TEXT,
        stock_code TEXT,
        stock_name TEXT,
        price REAL,
        change_percent REAL,
        turnover_rate REAL,
        amount REAL,
        mkt_cap REAL,
        pe_ratio REAL,
        pb_ratio REAL,
        is_dragon_rank INTEGER,  -- 1=龙1, 2=龙2, 3=龙3, 0=普通
        dragon_reason TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # 3. 全市场总龙头与龙1/龙2梯队
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS market_leaders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trade_date TEXT,
        leader_type TEXT, -- 'MASTER'(总龙头), 'DRAGON_1'(龙1), 'DRAGON_2'(龙2)
        stock_code TEXT,
        stock_name TEXT,
        price REAL,
        change_percent REAL,
        turnover_rate REAL,
        amount REAL,
        sector_name TEXT,
        seal_time TEXT,       -- 首次封板/启动时间
        seal_strength REAL,   -- 封单/成交强度评分
        consecutive_boards INTEGER, -- 连板数
        analysis TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # 4. 龙虎榜明细表
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS dragon_tiger_daily (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trade_date TEXT,
        security_code TEXT,
        security_name TEXT,
        close_price REAL,
        change_rate REAL,
        billboard_net_amt REAL,
        buy_amt REAL,
        sell_amt REAL,
        explanation TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # 5. 限售解禁与重大事件
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS lockup_expirations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        security_code TEXT,
        security_name TEXT,
        free_date TEXT,
        limited_type TEXT,
        free_shares_type TEXT,
        total_ratio REAL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # 6. 果仁网多因子量化选股池
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS quant_factors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trade_date TEXT,
        stock_code TEXT,
        stock_name TEXT,
        momentum_20d REAL,   -- 20日动量因子
        momentum_60d REAL,   -- 60日动量因子
        volatility_factor REAL, -- 低波因子
        pe_percentile REAL,  -- PE历史分位数
        growth_score REAL,   -- 业绩成长打分
        composite_score REAL,-- 综合多因子打分
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # 7. 社区热度排行榜 (股吧/雪球舆情)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sentiment_ranking (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trade_date TEXT,
        rank_order INTEGER,
        stock_code TEXT,
        stock_name TEXT,
        heat_score REAL,
        sentiment_tag TEXT, -- '看多', '分歧', '看空'
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # 8. 板块历史估值表 (PE / PB 历史序列)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sector_valuation_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sector_code TEXT,
        sector_name TEXT,
        trade_date TEXT,
        pe_ratio REAL,
        pb_ratio REAL,
        avg_price REAL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(sector_code, trade_date)
    )
    """)

    # 9. 用户股票投研备注与操盘笔记表
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS stock_user_notes (
        stock_code TEXT PRIMARY KEY,
        stock_name TEXT,
        note_content TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    conn.commit()
    conn.close()
    logger.info("数据库与数据架构表初始化成功！")

def save_user_stock_note(stock_code: str, stock_name: str, note_content: str):
    """保存或更新用户对某只股票的操盘备注笔记"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO stock_user_notes (stock_code, stock_name, note_content, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(stock_code) DO UPDATE SET
        stock_name = excluded.stock_name,
        note_content = excluded.note_content,
        updated_at = CURRENT_TIMESTAMP
    """, (str(stock_code).strip(), str(stock_name or "").strip(), str(note_content or "").strip()))
    conn.commit()
    conn.close()

def get_user_stock_note(stock_code: str):
    """读取用户对指定股票的备注笔记"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT note_content, updated_at FROM stock_user_notes WHERE stock_code = ?", (str(stock_code).strip(),))
    row = cursor.fetchone()
    conn.close()
    if row:
        return {"note_content": row["note_content"] or "", "updated_at": str(row["updated_at"]) if row["updated_at"] else ""}
    return {"note_content": "", "updated_at": ""}

if __name__ == '__main__':
    init_db()

