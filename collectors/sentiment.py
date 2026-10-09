import json
import logging
from collectors.base import BaseCollector

logger = logging.getLogger("CollectorSentiment")

class SentimentCollector(BaseCollector):
    """股吧与社区舆情监控采集器"""

    def __init__(self):
        super().__init__(min_interval=0.3)

    def get_eastmoney_guba_ranks(self, limit=20):
        """抓取东方财富股吧全市场股票讨论热度榜单"""
        url = "https://emappdata.eastmoney.com/stockrank/getAllCurrentList"
        payload = {
            "appId": "appId01",
            "globalId": "786e4c00-70af-4e61-99d6-0c8a927a4d46",
            "srcPgid": "",
            "pageNo": 1,
            "pageSize": limit
        }
        res = self.post_json(url, json_data=payload)
        if not res or not res.get("data"):
            return []
        
        items = res.get("data", [])
        parsed = []
        for it in items:
            raw_code = it.get("sc", "")
            clean_code = raw_code.replace("SH", "").replace("SZ", "").replace("BJ", "")
            parsed.append({
                "raw_code": raw_code,
                "code": clean_code,
                "rank": it.get("rk"),
                "rank_change": it.get("rc"),
                "his_rank": it.get("hisRc")
            })
        return parsed
