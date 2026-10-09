import urllib.request
import logging
from collectors.base import BaseCollector

logger = logging.getLogger("CollectorTencent")

class TencentCollector(BaseCollector):
    """腾讯极速行情采集器，用于批量刷新毫秒级买卖盘与盘口异动"""

    def __init__(self):
        super().__init__(min_interval=0.1)

    def get_realtime_quotes(self, stock_codes):
        """
        批量获取股票实时行情快照
        stock_codes: ['603127', '001246', ...]
        """
        if not stock_codes:
            return {}
        
        # 格式化腾讯代码前缀
        q_list = []
        for code in stock_codes:
            c_str = str(code).lower().strip()
            if c_str.startswith(("sh", "sz", "bj")):
                q_list.append(c_str)
            elif c_str.startswith("6") or c_str.startswith("9"):
                q_list.append(f"sh{c_str}")
            elif c_str.startswith("0") or c_str.startswith("3"):
                q_list.append(f"sz{c_str}")
            elif c_str.startswith("4") or c_str.startswith("8"):
                q_list.append(f"bj{c_str}")
            else:
                q_list.append(f"sh{c_str}")
        
        url = f"http://qt.gtimg.cn/q={','.join(q_list)}"
        try:
            self._apply_anti_ban_delay(url)
            headers = self._generate_realistic_headers(url)
            headers.pop("Accept-Encoding", None)  # urllib 不自动解压 gzip，移除该标头接收纯文本
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=5) as resp:
                text = resp.read().decode("gbk", "ignore")
                
            results = {}
            for line in text.strip().split(";"):
                if not line.strip():
                    continue
                parts = line.split("~")
                if len(parts) >= 40:
                    code = parts[2]
                    # 获取腾讯完整前缀代码 (如 sh000001)
                    full_code = line.split("=")[0].split("_")[-1].strip() if "=" in line else code
                    item_data = {
                        "name": parts[1],
                        "code": code,
                        "full_code": full_code,
                        "current_price": float(parts[3] or 0),
                        "yesterday_close": float(parts[4] or 0),
                        "open_price": float(parts[5] or 0),
                        "volume": int(parts[6] or 0),
                        "change_amount": float(parts[31] or 0),
                        "change_percent": float(parts[32] or 0),
                        "high_price": float(parts[33] or 0),
                        "low_price": float(parts[34] or 0),
                        "amount": float(parts[37] or 0), # 万元
                        "turnover_rate": float(parts[38] or 0),
                        "pe_ratio": float(parts[39] or 0) if len(parts) > 39 else 0.0,
                        "circ_market_cap": float(parts[44] or 0) if len(parts) > 44 else 0.0, # 亿元
                        "total_market_cap": float(parts[45] or 0) if len(parts) > 45 else 0.0,
                    }
                    results[code] = item_data
                    if full_code and full_code != code:
                        results[full_code] = item_data
            return results
        except Exception as e:
            logger.error(f"批量请求腾讯行情失败: {e}")
            return {}

    def get_kline_data(self, stock_code, period="day", limit=120):
        """
        获取单只股票的前复权 K 线数据
        period 支持: 'day' (日线), 'week' (周线), 'month' (月线), 'year' (年线)
        返回: [{"date": "2026-09-30", "open": 1239.5, "close": 1258.6, "high": 1268.0, "low": 1236.0, "volume": 38331}, ...]
        """
        raw_code = stock_code.lower()
        if raw_code.startswith("sh") or raw_code.startswith("sz") or raw_code.startswith("bj"):
            symbol = raw_code
        else:
            prefix = "sh" if (raw_code.startswith("6") or raw_code.startswith("9")) else ("sz" if (raw_code.startswith("0") or raw_code.startswith("3")) else "bj")
            symbol = f"{prefix}{raw_code}"
        
        # 年线通过月线聚合，提供长达数十年的真实历史年K线
        target_period = "month" if period == "year" else period
        req_limit = 320 if period == "year" else limit
        
        url = f"http://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param={symbol},{target_period},,,{req_limit},qfq"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                import json
                data = json.loads(resp.read().decode("utf-8"))
            
            st_data = data.get("data", {}).get(symbol, {})
            candle_list = st_data.get(f"qfq{target_period}", st_data.get(target_period, []))
            
            if period == "year":
                # 按年份聚合月K线为年K线
                yearly_dict = {}
                for m in candle_list:
                    if len(m) >= 6:
                        y_key = m[0].split("-")[0]
                        o_val = float(m[1])
                        c_val = float(m[2])
                        h_val = float(m[3])
                        l_val = float(m[4])
                        v_val = float(m[5])
                        if y_key not in yearly_dict:
                            yearly_dict[y_key] = {
                                "date": y_key,
                                "open": o_val,
                                "close": c_val,
                                "high": h_val,
                                "low": l_val,
                                "volume": v_val
                            }
                        else:
                            yearly_dict[y_key]["close"] = c_val
                            yearly_dict[y_key]["high"] = max(yearly_dict[y_key]["high"], h_val)
                            yearly_dict[y_key]["low"] = min(yearly_dict[y_key]["low"], l_val)
                            yearly_dict[y_key]["volume"] += v_val
                return list(yearly_dict.values())[-limit:]

            klines = []
            for item in candle_list:
                # 格式: [date, open, close, high, low, volume, ...]
                if len(item) >= 6:
                    klines.append({
                        "date": item[0],
                        "open": float(item[1]),
                        "close": float(item[2]),
                        "high": float(item[3]),
                        "low": float(item[4]),
                        "volume": float(item[5])
                    })
            return klines[-limit:]
        except Exception as e:
            logger.error(f"获取股票 {stock_code} {period}线异常: {e}")
            return []

    def get_intraday_minute(self, stock_code):
        """
        获取股票即时分时走势数据
        返回: [{"time": "09:30", "price": 1239.5, "volume": 1200, "avg_price": 1239.5}, ...]
        """
        prefix = "sh" if (stock_code.startswith("6") or stock_code.startswith("9")) else ("sz" if (stock_code.startswith("0") or stock_code.startswith("3")) else "bj")
        symbol = f"{prefix}{stock_code}"
        url = f"http://web.ifzq.gtimg.cn/appstock/app/minute/query?code={symbol}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                import json
                data = json.loads(resp.read().decode("utf-8"))
            
            min_lines = data.get("data", {}).get(symbol, {}).get("data", {}).get("data", [])
            minutes = []
            for line in min_lines:
                # 格式: "0930 1239.50 1200 1487400.00"
                parts = line.split(" ")
                if len(parts) >= 3:
                    raw_time = parts[0]
                    formatted_time = f"{raw_time[:2]}:{raw_time[2:]}" if len(raw_time) == 4 else raw_time
                    price = float(parts[1])
                    vol = int(parts[2])
                    total_amt = float(parts[3]) if len(parts) > 3 else (price * vol)
                    avg_p = round(total_amt / max(1, vol), 2) if vol > 0 else price
                    minutes.append({
                        "time": formatted_time,
                        "price": price,
                        "volume": vol,
                        "avg_price": avg_p
                    })
            return minutes
        except Exception as e:
            logger.error(f"获取股票 {stock_code} 即时分时异常: {e}")
            return []
