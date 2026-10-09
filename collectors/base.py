import time
import random
import requests
import logging
from urllib.parse import urlparse

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("CollectorBase")

# 浏览器真实 User-Agent 指纹池 (包含 Chrome, Edge, Firefox, Safari 各主流版本)
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
]

# 针对不同数据源对象的安全防封频控基准 (秒)
TARGET_DELAY_PROFILES = {
    "eastmoney.com": {"base": 0.8, "jitter": (0.3, 0.9), "max_burst": 3},  # 东财反爬较严，预留0.8~1.7s随机抖动
    "emappdata.eastmoney.com": {"base": 1.2, "jitter": (0.5, 1.2), "max_burst": 2}, # 股吧舆情榜，严格限制频率
    "gtimg.cn": {"base": 0.3, "jitter": (0.1, 0.35), "max_burst": 6},     # 腾讯行情接口吞吐大，平滑短脉冲
    "sina.com.cn": {"base": 0.6, "jitter": (0.2, 0.6), "max_burst": 4},   # 新浪财经接口中等频率
    "default": {"base": 0.6, "jitter": (0.2, 0.7), "max_burst": 3}
}

class BaseCollector:
    """
    工业级防封 IP、防爬虫检测的金融数据采集基类：
    1. 动态指纹伪装：随机轮换主流浏览器 User-Agent、Sec-Ch-Ua、Referer、Accept 标头
    2. 针对不同目标源（腾讯/东财/新浪/股吧）精细化阶梯控频 (Per-Host Rate Limiter)
    3. 人性化随机抖动时间 (Gaussian/Uniform Jitter)，抹平机器周期性请求特征
    4. 熔断与冷却机制 (Circuit Breaker & Exponential Backoff)：遇 429/403/超时自动倍数休眠，保护 IP
    5. 直连中国大陆金融网络节点，绕过代理导致的阻断
    """
    
    _host_last_access = {} # 记录每个域名的最后访问时间戳
    _host_burst_count = {} # 记录连续快速请求数

    def __init__(self, target_domain=None, min_interval=None, **kwargs):
        self.session = requests.Session()
        self.session.trust_env = False  # 直连网络节点
        self.target_domain = target_domain
        self.min_interval = min_interval

    def _get_profile_for_url(self, url):
        try:
            parsed = urlparse(url)
            host = parsed.netloc.lower()
            for key, prof in TARGET_DELAY_PROFILES.items():
                if key in host:
                    return host, prof
            return host or "default", TARGET_DELAY_PROFILES["default"]
        except Exception:
            return "default", TARGET_DELAY_PROFILES["default"]

    def _apply_anti_ban_delay(self, url):
        """核心防封控逻辑：基于目标对象域名的差异化随机休眠"""
        host, profile = self._get_profile_for_url(url)
        now = time.time()
        last_time = BaseCollector._host_last_access.get(host, 0.0)
        elapsed = now - last_time

        base_delay = profile["base"]
        j_min, j_max = profile["jitter"]
        burst_limit = profile.get("max_burst", 3)

        # 连续请求惩罚机制：如果连续多次调用同一域名，额外累加惩罚随机等待时间
        cur_burst = BaseCollector._host_burst_count.get(host, 0)
        if elapsed < (base_delay + j_min):
            cur_burst += 1
        else:
            cur_burst = max(0, cur_burst - 1)
        BaseCollector._host_burst_count[host] = cur_burst

        burst_penalty = 0.0
        if cur_burst >= burst_limit:
            burst_penalty = random.uniform(0.5, 1.2) * (cur_burst - burst_limit + 1)
            # 适度清理，防止死锁
            if cur_burst > burst_limit + 4:
                BaseCollector._host_burst_count[host] = 0

        # 计算拟人化休眠时间 (随机浮动)
        target_sleep = base_delay + random.uniform(j_min, j_max) + burst_penalty
        needed_sleep = target_sleep - elapsed

        if needed_sleep > 0:
            time.sleep(needed_sleep)

        BaseCollector._host_last_access[host] = time.time()

    def _generate_realistic_headers(self, url, custom_headers=None):
        """生成具备完整现代浏览器特征的伪装请求头"""
        parsed = urlparse(url)
        host = parsed.netloc

        ua = random.choice(USER_AGENTS)
        is_chrome = "Chrome" in ua

        headers = {
            "User-Agent": ua,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7" if "kline" in url or "php" in url else "application/json, text/javascript, */*; q=0.01",
            "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
            "Accept-Encoding": "gzip, deflate",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "Connection": "keep-alive"
        }

        if is_chrome:
            headers["Sec-Ch-Ua"] = '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"'
            headers["Sec-Ch-Ua-Mobile"] = "?0"
            headers["Sec-Ch-Ua-Platform"] = '"Windows"'
            headers["Sec-Fetch-Dest"] = "empty"
            headers["Sec-Fetch-Mode"] = "cors"
            headers["Sec-Fetch-Site"] = "same-site" if "eastmoney" in host or "gtimg" in host else "cross-site"

        # 根据不同采集源自动匹配官方 Referer
        if "eastmoney.com" in host:
            headers["Referer"] = "https://quote.eastmoney.com/"
        elif "sina.com.cn" in host:
            headers["Referer"] = "https://finance.sina.com.cn/"
        elif "gtimg.cn" in host:
            headers["Referer"] = "https://gu.qq.com/"

        if custom_headers:
            headers.update(custom_headers)
        return headers

    def get_json(self, url, params=None, headers=None, timeout=8, retries=3):
        for attempt in range(1, retries + 1):
            self._apply_anti_ban_delay(url)
            request_headers = self._generate_realistic_headers(url, headers)
            try:
                resp = self.session.get(url, params=params, headers=request_headers, timeout=timeout)
                if resp.status_code == 200:
                    if "sina.com.cn" in url:
                        resp.encoding = "gb18030"
                    elif resp.encoding is None or resp.encoding.lower() == "iso-8859-1":
                        resp.encoding = resp.apparent_encoding or "utf-8"
                    try:
                        return resp.json()
                    except Exception:
                        text = resp.text.strip()
                        if "(" in text and text.endswith(")"):
                            start = text.index("(") + 1
                            end = text.rindex(")")
                            import json
                            return json.loads(text[start:end])
                        return {"text": text}
                elif resp.status_code in [429, 403]:
                    # 触发限频或反爬封锁，触发指数退避冷却 (1.8s ~ 4.5s)
                    cool_down = 1.8 * attempt + random.uniform(0.5, 1.5)
                    logger.warning(f"源站返回状态码 {resp.status_code}，触发防封冷却休眠 {cool_down:.2f}秒: {url}")
                    time.sleep(cool_down)
                else:
                    logger.warning(f"请求异常状态码 {resp.status_code} [{attempt}/{retries}] {url}")
                    time.sleep(0.6 * attempt)
            except requests.exceptions.RequestException as e:
                backoff = (0.8 * attempt) + random.uniform(0.2, 0.6)
                logger.warning(f"网络连接抖动 [{attempt}/{retries}] {url}: {e}，避让休眠 {backoff:.2f}s")
                time.sleep(backoff)
            except Exception as e:
                logger.warning(f"解析异常 [{attempt}/{retries}] {url}: {e}")
                time.sleep(0.5)
        return None

    def post_json(self, url, json_data=None, headers=None, timeout=8, retries=3):
        for attempt in range(1, retries + 1):
            self._apply_anti_ban_delay(url)
            request_headers = self._generate_realistic_headers(url, headers)
            request_headers["Content-Type"] = "application/json"
            try:
                resp = self.session.post(url, json=json_data, headers=request_headers, timeout=timeout)
                if resp.status_code == 200:
                    return resp.json()
                elif resp.status_code in [429, 403]:
                    cool_down = 2.0 * attempt + random.uniform(0.5, 1.5)
                    logger.warning(f"POST 限频/风控 {resp.status_code}，冷却 {cool_down:.2f}秒: {url}")
                    time.sleep(cool_down)
            except Exception as e:
                logger.warning(f"POST 请求失败 [{attempt}/{retries}] {url}: {e}")
                time.sleep(0.8 * attempt)
        return None

