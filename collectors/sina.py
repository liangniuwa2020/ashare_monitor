import re
import json
import logging
from datetime import datetime
from collectors.base import BaseCollector

logger = logging.getLogger("CollectorSina")

class SinaCollector(BaseCollector):
    """新浪财经板块与行情采集器，高并发直连、低延迟稳定"""

    def __init__(self):
        super().__init__(min_interval=0.2)

    def get_all_industry_sectors(self):
        """获取全市场行业板块列表及领涨股"""
        url = "http://vip.stock.finance.sina.com.cn/q/view/newSinaHy.php"
        headers = {
            "Referer": "http://finance.sina.com.cn",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        }
        res = self.get_json(url, headers=headers)
        sectors = []
        if res and "text" in res:
            matches = re.findall(r'"([^"]+)":"([^"]+)"', res["text"])
            for code, val in matches:
                parts = val.split(',')
                if len(parts) >= 13:
                    try:
                        leader_clean_code = parts[8].replace("sh", "").replace("sz", "").replace("bj", "")
                        sectors.append({
                            "sector_code": parts[0],
                            "sector_name": parts[1],
                            "stock_count": int(parts[2]),
                            "avg_price": float(parts[3]),
                            "change_percent": round(float(parts[5]), 2),
                            "volume": int(parts[6]),
                            "amount": float(parts[7]),
                            "leader_code": leader_clean_code,
                            "leader_full_code": parts[8],
                            "leader_change": round(float(parts[9]), 2),
                            "leader_price": float(parts[10]),
                            "leader_name": parts[12]
                        })
                    except Exception as e:
                        continue

        # 动态补充/聚合【贵金属】(Precious Metals) 主要行业板块
        try:
            gjs_stocks = self.get_sector_constituents("chgn_700107", limit=100)
            if gjs_stocks:
                gjs_leader = max(gjs_stocks, key=lambda x: x.get("change_percent", 0))
                gjs_avg_price = round(sum(s.get("price", 0) for s in gjs_stocks) / len(gjs_stocks), 2)
                gjs_avg_chg = round(sum(s.get("change_percent", 0) for s in gjs_stocks) / len(gjs_stocks), 2)
                gjs_vol = sum(s.get("volume", 0) for s in gjs_stocks)
                gjs_amt = sum(s.get("amount", 0) for s in gjs_stocks)
                leader_code = gjs_leader.get("code") or gjs_leader.get("symbol", "").replace("sh", "").replace("sz", "")
                sectors.append({
                    "sector_code": "new_gjs",
                    "sector_name": "贵金属",
                    "stock_count": len(gjs_stocks),
                    "avg_price": gjs_avg_price,
                    "change_percent": gjs_avg_chg,
                    "volume": gjs_vol,
                    "amount": gjs_amt,
                    "leader_code": leader_code,
                    "leader_full_code": gjs_leader.get("symbol", leader_code),
                    "leader_change": gjs_leader.get("change_percent", 0),
                    "leader_price": gjs_leader.get("price", 0),
                    "leader_name": gjs_leader.get("name", "")
                })
        except Exception as e_gjs:
            logger.warning(f"动态构建贵金属板块数据异常: {e_gjs}")
        
        # 默认按板块涨幅降序排列
        sectors.sort(key=lambda x: x["change_percent"], reverse=True)
        return sectors

    _cached_all_sectors = None
    _cached_sectors_time = 0

    def get_all_market_sectors(self):
        """
        获取全市场所有几百个板块（包含全部行业板块、细分行业二级分类、概念板块等）
        并自动生成拼音缩写（首字母）与全拼，用于快速联想搜索（带内存缓存）
        """
        import time
        if SinaCollector._cached_all_sectors and (time.time() - SinaCollector._cached_sectors_time < 300):
            return SinaCollector._cached_all_sectors

        from pypinyin import pinyin, lazy_pinyin, Style

        # 1. 优先获取主行业板块作为基准
        main_sectors = self.get_all_industry_sectors()
        sector_map = {s["sector_code"]: s for s in main_sectors}

        # 2. 递归拉取新浪全量行情中心所有板块节点 (800+ 个行业与概念子节点)
        url = "http://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodes"
        headers = {"Referer": "http://finance.sina.com.cn"}
        res = self.get_json(url, headers=headers)
        
        all_raw_nodes = []
        if isinstance(res, list):
            def scan_nodes(data, cat_name=""):
                if isinstance(data, list):
                    if len(data) >= 3 and isinstance(data[0], str) and isinstance(data[2], str) and data[2]:
                        c = data[2]
                        n = data[0]
                        if (c.startswith("hangye_") or c.startswith("new_") or c.startswith("chgn_") or c.startswith("zhishu_")) and not c.endswith("_up") and not c.endswith("_down"):
                            all_raw_nodes.append({"name": n, "code": c, "category": cat_name})
                    for sub in data:
                        scan_nodes(sub, data[0] if len(data) > 0 and isinstance(data[0], str) else cat_name)
            scan_nodes(res)

        # 3. 合并与拼音索引生成
        result_list = []
        seen = set()

        # 先加入主行业
        for s in main_sectors:
            seen.add(s["sector_code"])
            name = s["sector_name"]
            py_initials = "".join([item[0] for item in pinyin(name, style=Style.FIRST_LETTER)]).upper()
            py_full = "".join(lazy_pinyin(name)).lower()
            result_list.append({
                "sector_code": s["sector_code"],
                "sector_name": name,
                "category": "主要行业",
                "stock_count": s["stock_count"],
                "change_percent": s["change_percent"],
                "amount": s["amount"],
                "leader_name": s["leader_name"],
                "pinyin_initials": py_initials,
                "pinyin_full": py_full
            })

        # 加入其它细分行业与概念板块
        for node in all_raw_nodes:
            code = node["code"]
            name = node["name"]
            if code in seen or len(name.strip()) <= 1:
                continue
            seen.add(code)
            
            py_initials = "".join([item[0] for item in pinyin(name, style=Style.FIRST_LETTER)]).upper()
            py_full = "".join(lazy_pinyin(name)).lower()
            
            result_list.append({
                "sector_code": code,
                "sector_name": name,
                "category": node.get("category", "细分/概念板块"),
                "stock_count": 0,
                "change_percent": 0.0,
                "amount": 0.0,
                "leader_name": "",
                "pinyin_initials": py_initials,
                "pinyin_full": py_full
            })

        SinaCollector._cached_all_sectors = result_list
        SinaCollector._cached_sectors_time = time.time()
        return result_list

    def get_sector_constituents(self, sector_code, limit=None):
        """获取特定板块的所有成分股并按涨幅排序（支持分页自动拉取全量）"""
        page = 1
        page_size = 100
        all_stocks = []
        max_limit = limit if limit and limit > 0 else 500

        # 板块代码映射别名转换（如 贵金属 new_gjs / BK0732 -> 新浪黄金股概念 chgn_700107）
        query_node = sector_code
        if sector_code in ["new_gjs", "BK0732", "gjs", "guijinshu", "贵金属"]:
            query_node = "chgn_700107"

        while True:
            url = "http://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeData"
            params = {
                "page": page,
                "num": page_size,
                "sort": "changepercent",
                "asc": 0,
                "node": query_node
            }
            headers = {"Referer": "http://finance.sina.com.cn"}
            data = self.get_json(url, params=params, headers=headers)
            if not isinstance(data, list) or len(data) == 0:
                break
            
            for item in data:
                try:
                    all_stocks.append({
                        "symbol": item.get("symbol"),
                        "code": item.get("code"),
                        "name": item.get("name"),
                        "price": float(item.get("trade", 0)),
                        "change_percent": round(float(item.get("changepercent", 0)), 2),
                        "open": float(item.get("open", 0)),
                        "high": float(item.get("high", 0)),
                        "low": float(item.get("low", 0)),
                        "settlement": float(item.get("settlement", 0)),
                        "volume": int(item.get("volume", 0)),
                        "amount": float(item.get("amount", 0)),
                        "turnover_rate": round(float(item.get("turnoverratio", 0)), 2),
                        "pe_ratio": float(item.get("per", 0)) if item.get("per") else 0.0,
                        "pb_ratio": float(item.get("pb", 0)) if item.get("pb") else 0.0,
                        "mkt_cap": round(float(item.get("mktcap", 0)) / 10000, 2), # 换算为亿元
                        "circ_cap": round(float(item.get("nmc", 0)) / 10000, 2)
                    })
                except Exception:
                    continue

            if len(data) < page_size or len(all_stocks) >= max_limit:
                break
            page += 1

        return all_stocks[:max_limit]

    def get_all_a_gainers(self, limit=50):
        """全市场A股涨幅榜"""
        url = "http://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeData"
        params = {
            "page": 1,
            "num": limit,
            "sort": "changepercent",
            "asc": 0,
            "node": "hs_a"
        }
        headers = {"Referer": "http://finance.sina.com.cn"}
        data = self.get_json(url, params=params, headers=headers)
        if not isinstance(data, list):
            return []
        return [
            {
                "symbol": item.get("symbol"),
                "code": item.get("code"),
                "name": item.get("name"),
                "price": float(item.get("trade", 0)),
                "change_percent": round(float(item.get("changepercent", 0)), 2),
                "volume": int(item.get("volume", 0)),
                "amount": float(item.get("amount", 0)),
                "turnover_rate": round(float(item.get("turnoverratio", 0)), 2),
                "circ_cap": round(float(item.get("nmc", 0)) / 10000, 2)
            }
            for item in data if float(item.get("trade", 0)) > 0
        ]
