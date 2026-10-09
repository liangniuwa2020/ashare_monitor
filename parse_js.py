import urllib.request
import re

url = 'https://data.eastmoney.com/newstatic/js/bkzj/list.js'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req) as resp:
    text = resp.read().decode('utf-8')
    reps = re.findall(r'reportName[\'"]?\s*:\s*[\'"]([^\'"]+)', text)
    print('ReportNames:', set(reps))
    urls = re.findall(r'https?://[a-zA-Z0-9_\.-]+/[^\s\'"]+', text)
    print('Urls:', set(urls))
