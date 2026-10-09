import os
import requests

for k in ['http_proxy', 'https_proxy', 'all_proxy', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY']:
    os.environ.pop(k, None)

s = requests.Session()
s.trust_env = False

url = 'http://push2.eastmoney.com/api/qt/clist/get'
params = {
    'pn': 1, 'pz': 20, 'po': 1, 'np': 1,
    'ut': 'bd1d9ddb04089700cf9c27f6f7426281',
    'fltt': 2, 'invt': 2, 'fid': 'f3',
    'fs': 'm:90 t:2 f:!50',
    'fields': 'f12,f14,f2,f3,f62,f128,f140'
}
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'http://quote.eastmoney.com/'
}

try:
    r = s.get(url, params=params, headers=headers, timeout=5)
    print('HTTP status:', r.status_code)
    data = r.json()
    items = data.get('data', {}).get('diff', [])
    print(f'Successfully got {len(items)} sectors!')
    for item in items[:5]:
        print(f"Sector: {item['f14']} ({item['f12']}) | Change: {item['f3']}% | Leader: {item['f128']} ({item['f140']})")
except Exception as e:
    print('Error:', e)
