import requests

s = requests.Session()
s.trust_env = False  # 彻底阻止 requests 读取系统 IE 代理

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://data.eastmoney.com/bkzj/hy.html"
}

params = {
    "pn": "1",
    "pz": "20",
    "po": "1",
    "np": "1",
    "ut": "8dec03ba335b81bf4ebdf7b29ec27d15",
    "fltt": "2",
    "invt": "2",
    "fid": "f62",
    "fs": "m:90+t:2+f:!50",
    "fields": "f12,f14,f2,f3,f62,f184,f66,f69,f72,f75,f78,f81,f84,f87,f204,f205,f124"
}

url = "https://push2.eastmoney.com/api/qt/clist/get"
try:
    r = s.get(url, params=params, headers=headers, timeout=5)
    print("Status:", r.status_code)
    data = r.json()
    print("Total Sectors:", data.get("data", {}).get("total"))
    for it in data.get("data", {}).get("diff", [])[:5]:
        print(it.get("f14"), "涨跌幅:", it.get("f3"), "% 主力净流入(万):", round((it.get("f62") or 0)/10000, 2))
except Exception as e:
    print("Error:", type(e).__name__, e)
