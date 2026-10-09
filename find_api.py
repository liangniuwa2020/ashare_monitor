import urllib.request
import re

url = 'https://data.eastmoney.com/bkzj/hy.html'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
try:
    with urllib.request.urlopen(req, timeout=5) as resp:
        html = resp.read().decode('utf-8', 'ignore')
        # 提取引用的 js 脚本
        scripts = re.findall(r'src=["\']([^"\']+\.js[^"\']*)["\']', html)
        for s in scripts:
            print("Script:", s)
except Exception as e:
    print('err:', e)
