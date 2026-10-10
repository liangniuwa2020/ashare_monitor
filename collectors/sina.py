import re
import json
import logging
from datetime import datetime
from collectors.base import BaseCollector

logger = logging.getLogger("CollectorSina")

# 精确筛选：有自有矿山/金银矿采选资产的贵金属矿企池（剔除纯珠宝零售、纯冶炼代工、百货及非矿企业）
PRECIOUS_MINE_STOCKS = {
    '601899': {'name': '紫金矿业', 'mine_desc': '全球矿业巨头，巨量黄金、铜、锂矿山资源'},
    '600547': {'name': '山东黄金', 'mine_desc': '国内黄金矿业龙头，自产金储量超千吨'},
    '600489': {'name': '中金黄金', 'mine_desc': '央企黄金矿业龙头，多座大型金矿采选基地'},
    '600988': {'name': '赤峰黄金', 'mine_desc': '海内外多座优质金矿，高品位矿山高效采选'},
    '000975': {'name': '山金国际', 'mine_desc': '原银泰黄金，拥有黑河银泰等多座高品位大型金矿'},
    '002155': {'name': '湖南黄金', 'mine_desc': '黄金与锑矿核心龙头，坐拥沃溪等大型金锑钨矿山'},
    '601069': {'name': '西部黄金', 'mine_desc': '西北地区最大产金企业，拥有哈图等核心自产金矿'},
    '001337': {'name': '四川黄金', 'mine_desc': '拥有大型梭罗沟金矿，自产金毛利率极高'},
    '000506': {'name': '招金黄金', 'mine_desc': '原中润资源，布局斐济等海外金矿资源采选'},
    '000426': {'name': '兴业银锡', 'mine_desc': '国内白银与锡矿龙头，拥有银漫矿业等顶级高品位银多金属矿'},
    '000603': {'name': '盛达资源', 'mine_desc': '白银矿业龙头，控股银都矿业、金山矿业等多座高品位银铅锌矿山'},
    '002716': {'name': '湖南白银', 'mine_desc': '原金贵银业，拥有宝山矿业等银多金属矿采选资源'},
    '601212': {'name': '白银有色', 'mine_desc': '综合矿企，拥有境内外金银铜铅锌矿山资源'},
    '601020': {'name': '华钰矿业', 'mine_desc': '拥有塔吉克斯坦塔铝金业等大型金锑多金属矿山'},
    '601168': {'name': '西部矿业', 'mine_desc': '拥有玉龙铜矿等多座特大型矿山，伴生金银产量显著'},
    '603979': {'name': '金诚信', 'mine_desc': '拥有海外自营铜金银矿山资源，矿山工程采矿一体化'},
    '002237': {'name': '恒邦股份', 'mine_desc': '大型黄金冶炼与矿山开发企业，控股多座金矿采选基地'},
    '600531': {'name': '豫光金铅', 'mine_desc': '大型白银与黄金资源综合回收与伴生金银矿采选'},
    '600459': {'name': '贵研铂业', 'mine_desc': '稀贵金属龙头，布局铂族贵金属资源与矿料循环提取'},
    '300139': {'name': '晓程科技', 'mine_desc': '在加纳等非洲地区拥有三座黄金矿山金矿采矿权'},
    '603132': {'name': '金徽股份', 'mine_desc': '大型绿色矿山采选企业，拥有郭家沟等铅锌银矿山'},
    '000688': {'name': '国城矿业', 'mine_desc': '拥有多座有色金属矿山，含银铅锌金多金属采选'},
    '600497': {'name': '驰宏锌锗', 'mine_desc': '保有铅锌银金属资源储量超3000万吨，高品位银多金属矿'},
    '600711': {'name': '盛屯矿业', 'mine_desc': '拥有埃玛矿业等多座铅锌银铜矿山'}
}

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

        # 动态补充/聚合【贵金属】(Precious Metals 全概念) 主要行业板块
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

                # 动态补充/聚合【贵金属矿企】(专属纯矿山金银铜资源采选企业，剔除纯首饰零售及非矿)
                mine_stocks = [s for s in gjs_stocks if s.get("code") in PRECIOUS_MINE_STOCKS]
                if mine_stocks:
                    mine_leader = max(mine_stocks, key=lambda x: x.get("change_percent", 0))
                    mine_avg_price = round(sum(s.get("price", 0) for s in mine_stocks) / len(mine_stocks), 2)
                    mine_avg_chg = round(sum(s.get("change_percent", 0) for s in mine_stocks) / len(mine_stocks), 2)
                    mine_vol = sum(s.get("volume", 0) for s in mine_stocks)
                    mine_amt = sum(s.get("amount", 0) for s in mine_stocks)
                    mine_leader_code = mine_leader.get("code") or mine_leader.get("symbol", "").replace("sh", "").replace("sz", "")
                    sectors.append({
                        "sector_code": "new_gjs_mine",
                        "sector_name": "贵金属矿企",
                        "stock_count": len(mine_stocks),
                        "avg_price": mine_avg_price,
                        "change_percent": mine_avg_chg,
                        "volume": mine_vol,
                        "amount": mine_amt,
                        "leader_code": mine_leader_code,
                        "leader_full_code": mine_leader.get("symbol", mine_leader_code),
                        "leader_change": mine_leader.get("change_percent", 0),
                        "leader_price": mine_leader.get("price", 0),
                        "leader_name": mine_leader.get("name", "")
                    })
        except Exception as e_gjs:
            logger.warning(f"动态构建贵金属及贵金属矿企板块数据异常: {e_gjs}")
        
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

        # 板块代码映射别名转换（如 贵金属 new_gjs / 贵金属矿企 new_gjs_mine）
        is_mine_only = sector_code in ["new_gjs_mine", "gjs_mine", "贵金属矿企", "贵金属矿业", "黄金矿企"]
        query_node = sector_code
        if is_mine_only or sector_code in ["new_gjs", "BK0732", "gjs", "guijinshu", "贵金属"]:
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

        if is_mine_only:
            # 严格筛选仅保留有真实矿山资源的贵金属矿企
            all_stocks = [
                {
                    **st,
                    "mine_desc": PRECIOUS_MINE_STOCKS[st["code"]]["mine_desc"]
                }
                for st in all_stocks if st.get("code") in PRECIOUS_MINE_STOCKS
            ]

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
