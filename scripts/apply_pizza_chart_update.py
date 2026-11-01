# -*- coding: utf-8 -*-
import os
import sys

# 1. Update web/index.html
html_path = r'ashare_monitor/web/index.html'
with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

old_chart_card = '''        <!-- 核心图表卡片：VIX vs 披萨指数 34 年联动全景走势图 -->
        <div style="background: #111827; border: 1px solid #1e293b; border-radius: 12px; padding: 20px 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.4);">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 14px; border-bottom: 1px solid #1e293b; padding-bottom: 12px;">
                <div>
                    <h3 style="font-size: 17px; font-weight: 700; color: #f8fafc; display: flex; align-items: center; gap: 8px;">
                        <span>📈 VIX 恐慌指数 vs 五角大楼披萨指数 34 年全景联动走势图</span>
                        <span style="font-size: 12px; color: #94a3b8; font-weight: normal;">(双 Y 轴联动 · 底部全景时间轴缩放条 · 历次地缘危机事件标示)</span>
                    </h3>
                </div>

                <!-- 时间跨度快捷切换控制器 -->
                <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
                    <span style="font-size: 12px; color: #94a3b8; margin-right: 4px;">⏱️ 快捷区间:</span>
                    <button class="chart-tab-btn" onclick="zoomPanicTimeline('1m')">近1月</button>
                    <button class="chart-tab-btn" onclick="zoomPanicTimeline('6m')">近6月</button>
                    <button class="chart-tab-btn" onclick="zoomPanicTimeline('1y')">近1年</button>
                    <button class="chart-tab-btn" onclick="zoomPanicTimeline('3y')">近3年</button>
                    <button class="chart-tab-btn" onclick="zoomPanicTimeline('5y')">近5年</button>
                    <button class="chart-tab-btn" onclick="zoomPanicTimeline('10y')">近10年</button>
                    <button class="chart-tab-btn" onclick="zoomPanicTimeline('20y')">近20年</button>
                    <button class="chart-tab-btn active" id="btn-panic-zoom-all" onclick="zoomPanicTimeline('all')">全历史 (34+年)</button>
                </div>
            </div>'''

new_chart_card = '''        <!-- 核心图表卡片：五角大楼披萨指数 & VIX 恐慌指数 34 年全景看板 -->
        <div style="background: #111827; border: 1px solid #1e293b; border-radius: 12px; padding: 20px 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.4);">
            <!-- 图表形态与时间跨度控制栏 -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 14px; border-bottom: 1px solid #1e293b; padding-bottom: 12px;">
                <div>
                    <!-- 模式切换按钮组 (默认聚焦 🍕 五角大楼披萨指数独立图表) -->
                    <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 10px; background: rgba(15, 23, 42, 0.9); padding: 5px 8px; border-radius: 8px; border: 1px solid #1e293b; width: fit-content;">
                        <span style="font-size: 12px; color: #94a3b8; font-weight: 600; margin-right: 4px;">📊 图表形态:</span>
                        <button class="primary-btn" id="panic-tab-pizza" onclick="switchPanicChartMode('pizza')" style="font-size: 12px; padding: 4px 12px; border-radius: 6px; cursor: pointer;">
                            🍕 五角大楼披萨指数 (独立图表)
                        </button>
                        <button class="chart-tab-btn" id="panic-tab-vix" onclick="switchPanicChartMode('vix')" style="font-size: 12px; padding: 4px 12px; border-radius: 6px; cursor: pointer;">
                            📉 CBOE VIX 恐慌指数 (独立图表)
                        </button>
                        <button class="chart-tab-btn" id="panic-tab-combined" onclick="switchPanicChartMode('combined')" style="font-size: 12px; padding: 4px 12px; border-radius: 6px; cursor: pointer;">
                            ⚡ 双指标联动对照 (双Y轴图)
                        </button>
                        <button class="chart-tab-btn" id="panic-tab-dual" onclick="switchPanicChartMode('dual')" style="font-size: 12px; padding: 4px 12px; border-radius: 6px; cursor: pointer;">
                            📜 上下双图全貌并列
                        </button>
                    </div>

                    <h3 style="font-size: 17px; font-weight: 700; color: #f8fafc; display: flex; align-items: center; gap: 8px; margin: 0;" id="panic-chart-main-title">
                        <span>🍕 五角大楼披萨指数 (Pizza Meter) 全景走势图表</span>
                        <span style="font-size: 12px; color: #94a3b8; font-weight: normal;" id="panic-chart-sub-title">(地缘军情外卖指数 · DEFCON 1~5 战备色带 · 深夜外卖倍数副图 · 34年连续时序)</span>
                    </h3>
                </div>

                <!-- 时间跨度快捷切换控制器 -->
                <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-top: 6px;">
                    <span style="font-size: 12px; color: #94a3b8; margin-right: 4px;">⏱️ 快捷区间:</span>
                    <button class="chart-tab-btn" onclick="zoomPanicTimeline('1m')">近1月</button>
                    <button class="chart-tab-btn" onclick="zoomPanicTimeline('6m')">近6月</button>
                    <button class="chart-tab-btn" onclick="zoomPanicTimeline('1y')">近1年</button>
                    <button class="chart-tab-btn" onclick="zoomPanicTimeline('3y')">近3年</button>
                    <button class="chart-tab-btn" onclick="zoomPanicTimeline('5y')">近5年</button>
                    <button class="chart-tab-btn" onclick="zoomPanicTimeline('10y')">近10年</button>
                    <button class="chart-tab-btn" onclick="zoomPanicTimeline('20y')">近20年</button>
                    <button class="chart-tab-btn active" id="btn-panic-zoom-all" onclick="zoomPanicTimeline('all')">全历史 (34+年)</button>
                </div>
            </div>'''

if old_chart_card in html:
    html = html.replace(old_chart_card, new_chart_card)
    print("SUCCESS: index.html header updated!")
else:
    print("WARNING: old_chart_card not found directly in index.html, checking fuzzy...")
    # Find start and end
    start_tag = '<!-- 核心图表卡片：'
    end_tag = 'id="btn-panic-zoom-all" onclick="zoomPanicTimeline(\'all\')">全历史 (34+年)</button>\n                </div>\n            </div>'
    s_idx = html.find(start_tag)
    e_idx = html.find(end_tag)
    if s_idx != -1 and e_idx != -1:
        e_idx += len(end_tag)
        html = html[:s_idx] + new_chart_card + html[e_idx:]
        print("SUCCESS: index.html header updated by fuzzy index!")
    else:
        print("ERROR: could not locate chart card header in index.html")
        sys.exit(1)

# Also update height of panic-vix-pizza-chart to 560px
html = html.replace('<div id="panic-vix-pizza-chart" style="width: 100%; height: 530px;">', '<div id="panic-vix-pizza-chart" style="width: 100%; height: 560px;">')

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html)
print("SUCCESS: index.html saved!")
