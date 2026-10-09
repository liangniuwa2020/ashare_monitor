import urllib.request
import re

def test_sina_sectors():
    url = 'http://vip.stock.finance.sina.com.cn/q/view/newSinaHy.php'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'http://finance.sina.com.cn'})
    content = urllib.request.urlopen(req, timeout=5).read().decode('gbk', 'ignore')
    
    matches = re.findall(r'"([^"]+)":"([^"]+)"', content)
    print(f"Total industry sectors found: {len(matches)}")
    
    sectors = []
    for code, val in matches:
        parts = val.split(',')
        if len(parts) >= 13:
            sectors.append({
                "code": parts[0],
                "name": parts[1],
                "stock_count": int(parts[2]),
                "avg_price": float(parts[3]),
                "change_percent": float(parts[5]),
                "volume": int(parts[6]),
                "amount": float(parts[7]),
                "leader_code": parts[8],
                "leader_change": float(parts[9]),
                "leader_price": float(parts[10]),
                "leader_name": parts[12]
            })
            
    # 按涨跌幅倒序排序，取出前20板块
    sectors.sort(key=lambda x: x["change_percent"], reverse=True)
    top20 = sectors[:20]
    print(f"--- Top 20 Sectors ---")
    for i, s in enumerate(top20, 1):
        print(f"#{i:02d} {s['name']} ({s['code']}) | 涨幅: {s['change_percent']:.2f}% | 成交额: {s['amount']/1e8:.2f}亿 | 领涨: {s['leader_name']}({s['leader_code']}) +{s['leader_change']:.2f}%")

if __name__ == '__main__':
    test_sina_sectors()
