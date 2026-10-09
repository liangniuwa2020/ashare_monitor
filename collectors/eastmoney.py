import json
import logging
import urllib.request
import re
from collectors.base import BaseCollector

logger = logging.getLogger("CollectorEastmoney")

class EastmoneyCollector(BaseCollector):
    """东方财富全量数据中心与历史分时/K线采集器"""

    def __init__(self):
        super().__init__(min_interval=0.25)

    def get_dragon_tiger_list(self, page=1, page_size=20):
        """龙虎榜每日机构与游资成交席位明细"""
        url = "https://datacenter-web.eastmoney.com/api/data/v1/get"
        params = {
            "reportName": "RPT_DAILYBILLBOARD_DETAILS",
            "columns": "SECURITY_CODE,SECUCODE,SECURITY_NAME_ABBR,TRADE_DATE,EXPLANATION,CLOSE_PRICE,CHANGE_RATE,BILLBOARD_NET_AMT,BILLBOARD_BUY_AMT,BILLBOARD_SELL_AMT",
            "pageSize": page_size,
            "pageNumber": page,
            "sortColumns": "TRADE_DATE",
            "sortTypes": "-1"
        }
        res = self.get_json(url, params=params)
        if not res or not res.get("result"):
            return []
        
        items = res["result"].get("data", [])
        results = []
        for it in items:
            results.append({
                "code": it.get("SECURITY_CODE"),
                "secucode": it.get("SECUCODE"),
                "name": it.get("SECURITY_NAME_ABBR"),
                "trade_date": str(it.get("TRADE_DATE"))[:10],
                "explanation": it.get("EXPLANATION"),
                "close_price": it.get("CLOSE_PRICE"),
                "change_rate": it.get("CHANGE_RATE"),
                "net_amount": round(float(it.get("BILLBOARD_NET_AMT") or 0) / 10000, 2), # 万元
                "buy_amount": round(float(it.get("BILLBOARD_BUY_AMT") or 0) / 10000, 2),
                "sell_amount": round(float(it.get("BILLBOARD_SELL_AMT") or 0) / 10000, 2)
            })
        return results

    def get_lockup_expirations(self, page_size=20):
        """限售股解禁日程与规模监控"""
        url = "https://datacenter-web.eastmoney.com/api/data/v1/get"
        params = {
            "reportName": "RPT_LIFT_STAGE",
            "columns": "SECURITY_CODE,SECURITY_NAME_ABBR,FREE_DATE,LIMITED_TYPE,FREE_SHARES_TYPE,TOTAL_RATIO",
            "pageSize": page_size,
            "pageNumber": 1,
            "sortColumns": "FREE_DATE",
            "sortTypes": "-1"
        }
        res = self.get_json(url, params=params)
        if not res or not res.get("result"):
            return []
        items = res["result"].get("data", [])
        return [
            {
                "code": it.get("SECURITY_CODE"),
                "name": it.get("SECURITY_NAME_ABBR"),
                "free_date": str(it.get("FREE_DATE"))[:10],
                "limited_type": it.get("LIMITED_TYPE"),
                "free_shares_type": it.get("FREE_SHARES_TYPE"),
                "total_ratio": it.get("TOTAL_RATIO")
            }
            for it in items
        ]

    def get_holder_concentration(self, page_size=20):
        """股东人数变化与筹码集中度监测"""
        url = "https://datacenter-web.eastmoney.com/api/data/v1/get"
        params = {
            "reportName": "RPT_HOLDERNUMLATEST",
            "columns": "SECURITY_CODE,SECURITY_NAME_ABBR,END_DATE,HOLDER_NUM",
            "pageSize": page_size,
            "pageNumber": 1,
            "sortColumns": "END_DATE",
            "sortTypes": "-1"
        }
        res = self.get_json(url, params=params)
        if not res or not res.get("result"):
            return []
        items = res["result"].get("data", [])
        return [
            {
                "code": it.get("SECURITY_CODE"),
                "name": it.get("SECURITY_NAME_ABBR"),
                "end_date": str(it.get("END_DATE"))[:10],
                "holder_num": it.get("HOLDER_NUM")
            }
            for it in items
        ]

    def get_intraday_trends(self, stock_code, market="0"):
        """获取分时逐分钟量价走势（判定启动拐点）"""
        secid = f"{market}.{stock_code}"
        if stock_code.startswith("6") or stock_code.startswith("9"):
            secid = f"1.{stock_code}"
        elif stock_code.startswith("0") or stock_code.startswith("3"):
            secid = f"0.{stock_code}"
        
        url = "https://push2his.eastmoney.com/api/qt/stock/trends2/get"
        params = {
            "secid": secid,
            "fields1": "f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11",
            "fields2": "f51,f52,f53,f54,f55,f56,f57,f58"
        }
        res = self.get_json(url, params=params)
        if not res or not res.get("data"):
            return []
        
        trends = res["data"].get("trends", [])
        parsed_points = []
        for line in trends:
            # 格式: 2026-09-30 09:35,45.20,45.60,45.60,45.10,12000,5400000.00,45.320
            parts = line.split(',')
            if len(parts) >= 8:
                parsed_points.append({
                    "time": parts[0],
                    "open": float(parts[1]),
                    "close": float(parts[2]),
                    "high": float(parts[3]),
                    "low": float(parts[4]),
                    "volume": int(parts[5]),
                    "amount": float(parts[6]),
                    "avg_price": float(parts[7])
                })
        return parsed_points

    def get_daily_klines(self, stock_code, limit=60):
        """获取历史日K线（前复权，用于多因子计算）"""
        secid = f"1.{stock_code}" if stock_code.startswith("6") else f"0.{stock_code}"
        url = "https://push2his.eastmoney.com/api/qt/stock/kline/get"
        params = {
            "secid": secid,
            "fields1": "f1,f2,f3,f4,f5,f6",
            "fields2": "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61",
            "klt": 101,
            "fqt": 1,
            "end": "20500101",
            "lmt": limit
        }
        res = self.get_json(url, params=params)
        if not res or not res.get("data"):
            return []
        
        klines = res["data"].get("klines", [])
        parsed = []
        for line in klines:
            # 2026-09-30,44.70,49.30,49.30,44.24,554018,2647331801.00,11.29,10.00,4.48,8.83
            p = line.split(',')
            if len(p) >= 11:
                parsed.append({
                    "date": p[0],
                    "open": float(p[1]),
                    "close": float(p[2]),
                    "high": float(p[3]),
                    "low": float(p[4]),
                    "volume": int(p[5]),
                    "amount": float(p[6]),
                    "amplitude": float(p[7]),
                    "change_pct": float(p[8]),
                    "price_change": float(p[9]),
                    "turnover": float(p[10])
                })
        return parsed

    def get_stock_popularity_rank(self, stock_code):
        """获取东方财富全市场实时人气排名及今日排名轨迹"""
        clean_code = str(stock_code).strip()
        prefix = "SH" if clean_code.startswith(("6", "9")) else ("BJ" if clean_code.startswith(("4", "8")) else "SZ")
        full_code = f"{prefix}{clean_code}"
        url = "https://emappdata.eastmoney.com/stockrank/getCurrentList"
        data = json.dumps({
            "appId": "appId01",
            "globalId": "786e4c21-70",
            "srcSecurityCode": full_code
        }).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        try:
            req = urllib.request.Request(url, data=data, headers=headers)
            with urllib.request.urlopen(req, timeout=4) as resp:
                res = json.loads(resp.read().decode("utf-8"))
                rows = res.get("data") or []
                if rows:
                    curr_rank = rows[-1].get("rank")
                    min_rank = min(r.get("rank", 9999) for r in rows)
                    return {
                        "current_rank": curr_rank,
                        "best_rank_today": min_rank,
                        "history_count": len(rows),
                        "recent_ranks": [r.get("rank") for r in rows[-12:]],
                        "status": "in_top_list" if curr_rank and curr_rank <= 500 else "normal"
                    }
        except Exception as e:
            logger.warning(f"获取股票 {stock_code} 人气排名异常: {e}")
        return {
            "current_rank": None,
            "best_rank_today": None,
            "history_count": 0,
            "recent_ranks": [],
            "status": "unranked"
        }

    def get_stock_core_themes(self, stock_code):
        """获取个股关联核心题材及官方入选原因（精准题材归因）"""
        clean_code = str(stock_code).strip()
        url = "https://datacenter-web.eastmoney.com/api/data/v1/get"
        params = {
            "reportName": "RPT_F10_CORETHEME_BOARDTYPE",
            "columns": "SECUCODE,SECURITY_CODE,BOARD_CODE,BOARD_NAME,SELECTED_BOARD_REASON",
            "filter": f'(SECURITY_CODE="{clean_code}")',
            "pageNumber": 1,
            "pageSize": 35
        }
        res = self.get_json(url, params=params)
        if not res or not res.get("result"):
            return []
        items = res["result"].get("data", [])
        themes = []
        for it in items:
            name = it.get("BOARD_NAME")
            reason = it.get("SELECTED_BOARD_REASON")
            if name:
                themes.append({
                    "board_name": name,
                    "reason": reason.strip() if reason else ""
                })
        # 优先把带有详尽入选理由的核心题材排在前面
        themes.sort(key=lambda x: (1 if x["reason"] else 0, len(x["reason"])), reverse=True)
        return themes

    def get_stock_dragon_tiger_records(self, stock_code, limit=5):
        """获取近期龙虎榜上榜明细与异动原因"""
        clean_code = str(stock_code).strip()
        url = "https://datacenter-web.eastmoney.com/api/data/v1/get"
        params = {
            "reportName": "RPT_DAILYBILLBOARD_DETAILS",
            "columns": "SECURITY_CODE,SECUCODE,SECURITY_NAME_ABBR,TRADE_DATE,EXPLANATION,CLOSE_PRICE,CHANGE_RATE,BILLBOARD_NET_AMT,BILLBOARD_BUY_AMT,BILLBOARD_SELL_AMT",
            "filter": f'(SECURITY_CODE="{clean_code}")',
            "pageSize": limit,
            "sortColumns": "TRADE_DATE",
            "sortTypes": "-1"
        }
        res = self.get_json(url, params=params)
        if not res or not res.get("result"):
            return []
        items = res["result"].get("data", [])
        records = []
        for it in items:
            records.append({
                "trade_date": str(it.get("TRADE_DATE"))[:10],
                "explanation": it.get("EXPLANATION") or "异动上榜",
                "close_price": float(it.get("CLOSE_PRICE") or 0),
                "change_rate": float(it.get("CHANGE_RATE") or 0),
                "net_amount": round(float(it.get("BILLBOARD_NET_AMT") or 0) / 10000, 2), # 万元
                "buy_amount": round(float(it.get("BILLBOARD_BUY_AMT") or 0) / 10000, 2),
                "sell_amount": round(float(it.get("BILLBOARD_SELL_AMT") or 0) / 10000, 2)
            })
        return records

    def get_stock_recent_news(self, stock_code, limit=6):
        """获取股票最新重磅资讯与公告异动"""
        clean_code = str(stock_code).strip()
        url = f'https://search-api-web.eastmoney.com/search/jsonp?cb=cb&param=%7B%22uid%22%3A%22%22%2C%22keyword%22%3A%22{clean_code}%22%2C%22type%22%3A%5B%22cmsArticleWebOld%22%5D%2C%22client%22%3A%22web%22%2C%22clientType%22%3A%22web%22%2C%22clientVersion%22%3A%22curr%22%2C%22param%22%3A%7B%22cmsArticleWebOld%22%3A%7B%22searchScope%22%3A%22default%22%2C%22sort%22%3A%22default%22%2C%22pageIndex%22%3A1%2C%22pageSize%22%3A{limit}%2C%22preTag%22%3A%22%22%2C%22postTag%22%3A%22%22%7D%7D%7D'
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=4) as resp:
                raw = resp.read().decode("utf-8", "ignore")
                m = re.search(r"cb\((.*)\)", raw, re.DOTALL)
                if m:
                    d = json.loads(m.group(1))
                    articles = d.get("result", {}).get("cmsArticleWebOld", [])
                    clean_list = []
                    for a in articles:
                        title = re.sub(r"<[^>]+>", "", a.get("title", ""))
                        content = re.sub(r"<[^>]+>", "", a.get("content", ""))
                        clean_list.append({
                            "date": a.get("date"),
                            "title": title,
                            "summary": content[:120] + "..." if len(content) > 120 else content
                        })
                    return clean_list
        except Exception as e:
            logger.warning(f"获取股票 {stock_code} 最新资讯异常: {e}")
        return []

    def analyze_stock_popularity_reason(self, stock_code, stock_name=None, quote=None):
        """
        深度全景归因分析：解析当前股票高人气/高热度的多维核心成因
        涵盖：全市场热度排位、核心题材入选理由、量价盘口异动、龙虎榜游资动向、催化事件
        """
        clean_code = str(stock_code).strip()
        # 1. 人气排位
        rank_data = self.get_stock_popularity_rank(clean_code)
        
        # 2. 核心题材与入选理由
        themes = self.get_stock_core_themes(clean_code)
        
        # 3. 龙虎榜
        dragon_tiger = self.get_stock_dragon_tiger_records(clean_code, limit=3)
        
        # 4. 最新动态
        news = self.get_stock_recent_news(clean_code, limit=4)
        
        # 5. 行情特征提取
        q = quote or {}
        chg = float(q.get("change_percent") or 0)
        turnover = float(q.get("turnover_rate") or 0)
        amt = float(q.get("amount") or 0) # 腾讯万元或元
        vol_ratio = float(q.get("volume_ratio") or 1.0)
        
        # 6. 定性定位标签
        role_tags = []
        curr_rank = rank_data.get("current_rank")
        if curr_rank and curr_rank <= 10:
            role_tags.append(f"🔥 全市场人气Top {curr_rank}")
        elif curr_rank and curr_rank <= 50:
            role_tags.append(f"⭐ 全市场前排热股 #{curr_rank}")
        
        if chg >= 9.5:
            role_tags.append("⚡ 强势涨停封板")
        elif chg >= 5.0:
            role_tags.append("🚀 进攻主升放量")
        elif chg <= -9.0:
            role_tags.append("⚠️ 高位剧烈分歧/跌停")
        
        if turnover >= 15.0:
            role_tags.append("💥 极高换手博弈")
        elif turnover >= 7.0:
            role_tags.append("🌊 活跃高换手")
            
        # 7. 智能提炼核心归因小结 (AI Synthesis Points)
        synthesis = []
        
        # 题材归因
        reason_themes = [t for t in themes if t.get("reason")]
        if reason_themes:
            top_t = reason_themes[0]
            synthesis.append({
                "dimension": "🎯 核心热点题材共振",
                "title": f"深绑【{top_t['board_name']}】风口主线",
                "detail": top_t["reason"][:150] + ("..." if len(top_t["reason"]) > 150 else "")
            })
        elif themes:
            names = "、".join([t["board_name"] for t in themes[:4]])
            synthesis.append({
                "dimension": "🎯 概念板块覆盖",
                "title": f"叠加多重热门概念：{names}",
                "detail": f"该股横跨 {names} 等多条热门赛道，具备极高板块联动效应。"
            })

        # 资金与筹码归因
        if dragon_tiger:
            latest_dt = dragon_tiger[0]
            net_text = f"净买入 {latest_dt['net_amount']} 万元" if latest_dt['net_amount'] > 0 else f"净卖出 {abs(latest_dt['net_amount'])} 万元"
            synthesis.append({
                "dimension": "💰 龙虎榜席位与主力合力",
                "title": f"{latest_dt['trade_date']} 登上龙虎榜 ({net_text})",
                "detail": f"上榜原因：{latest_dt['explanation']}。机构或顶级游资深度参与交易，资金博弈烈度极高。"
            })
        elif turnover > 5.0:
            synthesis.append({
                "dimension": "💰 盘口流动性与换手活跃",
                "title": f"今日换手率达 {turnover}%",
                "detail": "筹码快速换手流转，场内外增量资金持续涌入承接，具备强烈的活跃流动性与博弈动能。"
            })

        # 市场人气与情绪归因
        if curr_rank and curr_rank <= 100:
            synthesis.append({
                "dimension": "🔥 散户与市场关注度爆发",
                "title": f"位列全市场人气榜前列 (当前第 {curr_rank} 名)",
                "detail": f"今日在东财及全网股票热度榜中排位靠前，社区讨论度剧增，散户跟风意愿与盘面关注度极强。"
            })
        elif news:
            top_news = news[0]
            synthesis.append({
                "dimension": "📰 最新舆情与事件驱动",
                "title": top_news["title"],
                "detail": top_news["summary"]
            })

        return {
            "stock_code": clean_code,
            "stock_name": stock_name or (q.get("name") if q else clean_code),
            "popularity_rank": rank_data,
            "role_tags": role_tags,
            "themes": themes,
            "dragon_tiger": dragon_tiger,
            "news": news,
            "synthesis": synthesis,
            "quote": q
        }

