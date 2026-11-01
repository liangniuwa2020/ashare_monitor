# -*- coding: utf-8 -*-
import os

target_path = r"e:\Antigravity ex_project\ashare_monitor\web\js\app.js"
with open(target_path, "r", encoding="utf-8") as f:
    content = f.read()

start_marker = "/* ============================================================\n   全球恐慌数据板块：CBOE VIX 恐慌指数 & 五角大楼披萨指数\n   ============================================================ */"
end_marker = "// 7. 渲染历次重大地缘危机与恐慌指数对比全量时序档案表"

crlf = "\r\n" in content
if crlf:
    start_marker = start_marker.replace("\n", "\r\n")
    end_marker = end_marker.replace("\n", "\r\n")

pos_start = content.find(start_marker)
pos_end = content.find(end_marker)

print(f"CRLF: {crlf}, Start: {pos_start}, End: {pos_end}")
