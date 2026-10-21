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

    @staticmethod
    def _to_em_secid(code: str) -> str:
        c = str(code).lower().strip()
        if c.startswith("sh"):
            return f"1.{c[2:]}"
        if c.startswith("sz") or c.startswith("bj"):
            return f"0.{c[2:]}"
        if c.startswith(("6", "9", "5")):
            return f"1.{c}"
        if c.startswith(("0", "3", "1", "4", "8", "2")):
            return f"0.{c}"
        return f"1.{c}"

    def get_kline_data(self, stock_code, period="day", limit=120):
        """
        获取单只股票/指数/ETF的前复权 K 线数据
        period 支持: 'day' (日线), 'week' (周线), 'month' (月线), 'year' (年线)
        返回: [{"date": "2026-09-30", "open": 1239.5, "close": 1258.6, "high": 1268.0, "low": 1236.0, "volume": 38331}, ...]
        优先使用新浪高可用接口（低延迟、免封禁、无 501 拦截），自动兼容指数、ETF与全市场标的
        """
        raw_code = str(stock_code).lower().strip()
        if raw_code.startswith(("sh", "sz", "bj")):
            symbol = raw_code
        else:
            prefix = "sh" if (raw_code.startswith("6") or raw_code.startswith("9") or raw_code.startswith("5")) else ("sz" if (raw_code.startswith("0") or raw_code.startswith("3") or raw_code.startswith("1")) else "bj")
            symbol = f"{prefix}{raw_code}"

        try:
            scale_map = {"day": 240, "week": 1200, "month": 7200, "year": 7200}
            scale = scale_map.get(period, 240)
            req_len = min(1023, max(limit, 120))
            url = f"http://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol={symbol}&scale={scale}&ma=no&datalen={req_len}"
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Referer": "https://finance.sina.com.cn"}
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=5) as r:
                import json
                raw_list = json.loads(r.read().decode("gbk"))

            if raw_list and isinstance(raw_list, list):
                if period == "year":
                    yearly_dict = {}
                    for it in raw_list:
                        y_key = it["day"].split("-")[0]
                        o_val = float(it["open"])
                        c_val = float(it["close"])
                        h_val = float(it["high"])
                        l_val = float(it["low"])
                        v_val = float(it["volume"]) / 100.0
                        if y_key not in yearly_dict:
                            yearly_dict[y_key] = {"date": y_key, "open": o_val, "close": c_val, "high": h_val, "low": l_val, "volume": v_val}
                        else:
                            yearly_dict[y_key]["close"] = c_val
                            yearly_dict[y_key]["high"] = max(yearly_dict[y_key]["high"], h_val)
                            yearly_dict[y_key]["low"] = min(yearly_dict[y_key]["low"], l_val)
                            yearly_dict[y_key]["volume"] += v_val
                    return list(yearly_dict.values())[-limit:]

                klines = []
                for it in raw_list:
                    klines.append({
                        "date": it["day"],
                        "open": float(it["open"]),
                        "close": float(it["close"]),
                        "high": float(it["high"]),
                        "low": float(it["low"]),
                        "volume": float(it["volume"]) / 100.0
                    })
                if klines:
                    return klines[-limit:]
        except Exception as e:
            logger.debug(f"新浪K线获取异常 ({stock_code}): {e}")

        # 备用源：东财通道
        try:
            secid = self._to_em_secid(stock_code)
            klt_map = {"day": 101, "week": 102, "month": 103, "year": 103}
            klt = klt_map.get(period, 101)
            req_limit = 320 if period == "year" else min(3000, max(limit, 120))
            url = f"https://push2his.eastmoney.com/api/qt/stock/kline/get?secid={secid}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt={klt}&fqt=1&end=20500101&lmt={req_limit}"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Referer": "https://quote.eastmoney.com/"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                import json
                data = json.loads(resp.read().decode("utf-8"))
            klines_raw = data.get("data", {}).get("klines", [])
            if klines_raw:
                klines = []
                for line in klines_raw:
                    parts = line.split(",")
                    if len(parts) >= 6:
                        klines.append({
                            "date": parts[0],
                            "open": float(parts[1]),
                            "close": float(parts[2]),
                            "high": float(parts[3]),
                            "low": float(parts[4]),
                            "volume": float(parts[5]),
                            "amount": float(parts[6]) if len(parts) > 6 else 0.0
                        })
                if klines:
                    return klines[-limit:]
        except Exception:
            pass

        return []

    def get_intraday_minute(self, stock_code):
        """
        获取股票即时分时走势数据
        返回: [{"time": "09:30", "price": 1239.5, "volume": 1200, "avg_price": 1239.5}, ...]
        优先使用新浪5分钟K线聚合日内走势
        """
        raw_code = str(stock_code).lower().strip()
        if raw_code.startswith(("sh", "sz", "bj")):
            symbol = raw_code
        else:
            prefix = "sh" if (raw_code.startswith("6") or raw_code.startswith("9") or raw_code.startswith("5")) else ("sz" if (raw_code.startswith("0") or raw_code.startswith("3") or raw_code.startswith("1")) else "bj")
            symbol = f"{prefix}{raw_code}"

        try:
            url = f"http://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol={symbol}&scale=5&ma=no&datalen=48"
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Referer": "https://finance.sina.com.cn"}
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=5) as r:
                import json
                raw_list = json.loads(r.read().decode("gbk"))

            if raw_list and isinstance(raw_list, list):
                minutes = []
                for it in raw_list:
                    t_str = it["day"].split(" ")[-1][:5]
                    p = float(it["close"])
                    v = int(float(it["volume"]) / 100.0)
                    minutes.append({
                        "time": t_str,
                        "price": p,
                        "volume": v,
                        "avg_price": p
                    })
                if minutes:
                    return minutes
        except Exception as e:
            logger.debug(f"获取分时异常 ({stock_code}): {e}")

        return []
