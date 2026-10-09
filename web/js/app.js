let sectorsData = [];
let allSectorsList = [];
let chosenSectorsForValuation = ["new_swzz", "new_cbzz", "new_ljhy"]; // 默认预选生物制造、船舶制造、量具行业对比
let currentValuationMetric = "pe"; // 'pe' or 'pb'
let currentValuationPeriod = "day"; // 'day', 'week', 'month', 'year'
let valuationChartInstance = null;
let currentStockChartCode = null;
let currentStockChartType = "minute"; // 'minute' or 'kline'
let singleStockChartInstance = null;

let marketHeatChartInstance = null;
let currentMarketHeatPeriod = "day"; // 'day', 'week', 'month', 'year'
let currentMarketHeatHistory = [];

let guornSentimentChartInstance = null;
let currentGuornIndexCode = "sh000001"; // 'sh000001', 'sh000300', 'sz399006', 'sh000905'
let currentGuornPeriod = "day"; // 'day', 'week', 'month'
let currentGuornHistory = [];

let guornIntensityChartInstance = null;
let currentGuornDomain = "all"; // 'all', 'hs300', 'zz500', 'cyb'
let currentGuornIntensityHistory = [];

document.addEventListener("DOMContentLoaded", () => {
    loadMarketHeatHistory(); // 优先载入页首全市场热度与历史热度图
    loadGuornSentiment(); // 载入果仁网大盘情绪温度计与量化择时
    loadGuornMarketVane(); // 载入果仁网市场风向标
    loadMarketOverview();
    loadMarketLeaders();
    loadMarketHotStocks(); // 全市场最热点个股榜单
    loadTop20Sectors();
    loadIntradayStrong();
    loadQuantFactors();
    loadSentimentRanking();
    loadDragonTiger();
    loadAllSectorsDropdown();

    // 默认如果进入估值页可以立即渲染
    renderValuationComparison();

    // 智能防封防频错峰轮询机制：避免固定周期和突发洪峰
    function scheduleNextPoll() {
        // 随机在 26s ~ 36s 之间浮动，彻底消除固定周期特征
        const nextInterval = 26000 + Math.floor(Math.random() * 10000);
        setTimeout(async () => {
            try {
                // 错峰平滑触发各个请求，每个请求之间微延时 300~600ms
                await loadMarketHeatHistory();
                await new Promise(r => setTimeout(r, 400 + Math.random() * 200));
                
                await loadGuornSentiment();
                await new Promise(r => setTimeout(r, 400 + Math.random() * 200));
                
                await loadGuornMarketVane();
                await new Promise(r => setTimeout(r, 400 + Math.random() * 200));
                
                await loadMarketOverview();
                await new Promise(r => setTimeout(r, 300 + Math.random() * 200));
                
                await loadMarketHotStocks();
                await new Promise(r => setTimeout(r, 300 + Math.random() * 200));
                
                await loadIntradayStrong();
            } catch (err) {
                console.warn("轮询调度异常:", err);
            } finally {
                scheduleNextPoll();
            }
        }, nextInterval);
    }

    scheduleNextPoll();
});

// 格式化金额
function formatMoney(amt) {
    if (!amt) return "0.00";
    if (amt >= 1e8) {
        return (amt / 1e8).toFixed(2) + " 亿";
    } else if (amt >= 1e4) {
        return (amt / 1e4).toFixed(2) + " 万";
    }
    return parseFloat(amt).toFixed(2);
}

// 视图切换: 市场看板 vs 果仁风向标与情绪择时 vs 板块估值对比
function switchMainView(viewType) {
    const btnCockpit = document.getElementById("nav-btn-cockpit");
    const btnGuorn = document.getElementById("nav-btn-guorn");
    const btnValuation = document.getElementById("nav-btn-valuation");

    const viewCockpit = document.getElementById("view-cockpit");
    const viewGuorn = document.getElementById("view-guorn");
    const viewValuation = document.getElementById("view-valuation");

    // 重置所有导航按钮样式
    btnCockpit.className = "chart-tab-btn";
    if (btnGuorn) btnGuorn.className = "chart-tab-btn";
    btnValuation.className = "chart-tab-btn";

    // 隐藏所有视图
    viewCockpit.style.display = "none";
    if (viewGuorn) viewGuorn.style.display = "none";
    viewValuation.style.display = "none";

    if (viewType === "cockpit") {
        btnCockpit.className = "primary-btn";
        viewCockpit.style.display = "flex";
        setTimeout(() => {
            if (marketHeatChartInstance) marketHeatChartInstance.resize();
        }, 80);
    } else if (viewType === "guorn") {
        if (btnGuorn) btnGuorn.className = "primary-btn";
        if (viewGuorn) viewGuorn.style.display = "flex";
        loadGuornMarketVane();
        loadGuornSentiment();
        setTimeout(() => {
            if (guornIntensityChartInstance) guornIntensityChartInstance.resize();
            if (guornSentimentChartInstance) guornSentimentChartInstance.resize();
        }, 80);
    } else if (viewType === "valuation") {
        btnValuation.className = "primary-btn";
        viewValuation.style.display = "flex";
        renderValuationComparison();
        setTimeout(() => {
            if (valuationChartInstance) valuationChartInstance.resize();
        }, 80);
    }
}

// 0. 加载页首【全市场热度板块】历史热度与情绪走势
async function loadMarketHeatHistory(period) {
    if (period) currentMarketHeatPeriod = period;
    try {
        const res = await fetch(`/api/market/heat_history?period=${currentMarketHeatPeriod}`);
        const json = await res.json();
        if (json.status !== "success") return;

        const cur = json.current_heat || {};
        document.getElementById("current-heat-tag").innerText = `当前全市场热度: ${cur.heat_index || '--'} (${cur.heat_level || ''})`;
        document.getElementById("metric-heat-val").innerText = cur.heat_index || '--';
        document.getElementById("metric-heat-level").innerText = cur.heat_level || '';
        document.getElementById("metric-volume-val").innerText = cur.volume_score || '--';
        document.getElementById("metric-price-val").innerText = cur.price_score || '--';
        document.getElementById("metric-index-val").innerText = cur.index_close ? cur.index_close.toFixed(2) : '--';
        
        const chg = cur.change_percent || 0;
        const chgDom = document.getElementById("metric-index-chg");
        chgDom.innerText = `上证综指 ${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%`;
        chgDom.style.color = chg >= 0 ? '#ef4444' : '#10b981';

        currentMarketHeatHistory = json.history || [];
        renderMarketHeatChart(currentMarketHeatHistory);
    } catch (e) {
        console.error("加载全市场历史热度失败:", e);
    }
}

// 切换市场热度周期 (day, week, month, year)
function switchMarketHeatPeriod(period) {
    currentMarketHeatPeriod = period;
    const periods = ["day", "week", "month", "year"];
    periods.forEach(p => {
        const btn = document.getElementById("heat-period-" + p);
        if (btn) {
            btn.className = (p === period) ? "chart-tab-btn active" : "chart-tab-btn";
        }
    });
    loadMarketHeatHistory(period);
}

// 快捷缩放时间区间 (近半年, 近1年, 近3年, 全部)
function zoomMarketHeatFast(type) {
    if (!marketHeatChartInstance || !currentMarketHeatHistory || currentMarketHeatHistory.length === 0) return;
    const total = currentMarketHeatHistory.length;
    let count = total;
    if (currentMarketHeatPeriod === 'day') {
        if (type === 'half_year') count = 125;
        else if (type === '1_year') count = 250;
        else if (type === '3_year') count = 750;
    } else if (currentMarketHeatPeriod === 'week') {
        if (type === 'half_year') count = 26;
        else if (type === '1_year') count = 52;
        else if (type === '3_year') count = 156;
    } else if (currentMarketHeatPeriod === 'month') {
        if (type === 'half_year') count = 6;
        else if (type === '1_year') count = 12;
        else if (type === '3_year') count = 36;
    } else {
        if (type === 'half_year' || type === '1_year') count = 2;
        else if (type === '3_year') count = 3;
    }

    let start = 0;
    if (type !== 'all' && total > count) {
        start = Math.max(0, Math.round(((total - count) / total) * 100));
    }

    marketHeatChartInstance.dispatchAction({
        type: 'dataZoom',
        start: start,
        end: 100
    });
}

// 获取当前热度图横轴可见数据范围及年份区间
function getVisibleMarketHeatDateRange(explicitStart, explicitEnd) {
    if (!currentMarketHeatHistory || currentMarketHeatHistory.length === 0) {
        return { startIndex: 0, endIndex: 0, startDate: '', endDate: '', yearRangeText: '历史时间轴' };
    }
    const dates = currentMarketHeatHistory.map(h => h.date);
    let startIndex = 0;
    let endIndex = dates.length - 1;

    if (explicitStart !== undefined && explicitEnd !== undefined) {
        startIndex = Math.max(0, Math.min(dates.length - 1, Math.floor((explicitStart / 100) * (dates.length - 1))));
        endIndex = Math.max(startIndex, Math.min(dates.length - 1, Math.ceil((explicitEnd / 100) * (dates.length - 1))));
    } else if (marketHeatChartInstance) {
        const opt = marketHeatChartInstance.getOption();
        if (opt && opt.dataZoom && opt.dataZoom.length > 0) {
            const dz = opt.dataZoom[0];
            if (dz.startValue !== undefined && typeof dz.startValue === 'number' && dz.startValue >= 0) {
                startIndex = Math.max(0, Math.min(dates.length - 1, Math.round(dz.startValue)));
                endIndex = Math.max(startIndex, Math.min(dates.length - 1, Math.round(dz.endValue)));
            } else if (dz.start !== undefined && dz.end !== undefined) {
                startIndex = Math.max(0, Math.min(dates.length - 1, Math.floor((dz.start / 100) * (dates.length - 1))));
                endIndex = Math.max(startIndex, Math.min(dates.length - 1, Math.ceil((dz.end / 100) * (dates.length - 1))));
            }
        }
    }

    const startDate = dates[startIndex] || '';
    const endDate = dates[endIndex] || '';
    const startYearMatch = String(startDate).match(/^(\d{4})/);
    const endYearMatch = String(endDate).match(/^(\d{4})/);
    const startYear = startYearMatch ? startYearMatch[1] : '';
    const endYear = endYearMatch ? endYearMatch[1] : '';

    let yearRangeText = "";
    if (startYear && endYear) {
        yearRangeText = (startYear === endYear) ? `${startYear}年` : `${startYear}年至${endYear}年`;
    } else if (startYear || endYear) {
        yearRangeText = `${startYear || endYear}年`;
    } else {
        yearRangeText = "横轴区间";
    }

    return { startIndex, endIndex, startDate, endDate, startYear, endYear, yearRangeText };
}

// 点击任意点位展示相对横轴数据的历史百分位分析卡片
function showMarketHeatPointDetail(pointDate) {
    const detailBox = document.getElementById("heat-point-detail-box");
    if (!detailBox || !currentMarketHeatHistory || currentMarketHeatHistory.length === 0) return;

    const rangeInfo = getVisibleMarketHeatDateRange();
    const visiblePoints = currentMarketHeatHistory.slice(rangeInfo.startIndex, rangeInfo.endIndex + 1);
    if (visiblePoints.length === 0) return;

    const targetPoint = currentMarketHeatHistory.find(h => h.date === pointDate) || visiblePoints[visiblePoints.length - 1];
    if (!targetPoint) return;

    // 计算在横轴区间内的百分位数 (Percentile Rank)
    const heatValues = visiblePoints.map(p => p.heat_index).filter(v => v !== undefined && v !== null);
    const volValues = visiblePoints.map(p => p.volume_score).filter(v => v !== undefined && v !== null);
    const priceValues = visiblePoints.map(p => p.price_score).filter(v => v !== undefined && v !== null);
    const indexValues = visiblePoints.map(p => p.index_close).filter(v => v !== undefined && v !== null);

    const calcPct = (arr, val) => {
        if (!arr || arr.length === 0 || val === undefined || val === null) return 50.0;
        const count = arr.filter(v => v <= val).length;
        return (Math.round((count / arr.length) * 1000) / 10).toFixed(1);
    };

    const calcMinMax = (arr) => {
        if (!arr || arr.length === 0) return { min: '--', max: '--' };
        return { min: Math.min(...arr).toFixed(1), max: Math.max(...arr).toFixed(1) };
    };

    const heatPct = calcPct(heatValues, targetPoint.heat_index);
    const volPct = calcPct(volValues, targetPoint.volume_score);
    const pricePct = calcPct(priceValues, targetPoint.price_score);
    const indexPct = calcPct(indexValues, targetPoint.index_close);

    const heatMinMax = calcMinMax(heatValues);
    const volMinMax = calcMinMax(volValues);
    const priceMinMax = calcMinMax(priceValues);
    const indexMinMax = calcMinMax(indexValues);

    let stateTag = `<span class="tag tag-gold">情绪均衡状态</span>`;
    if (heatPct >= 80) stateTag = `<span class="tag tag-red">🔥 狂热高潮区 (警惕透支)</span>`;
    else if (heatPct <= 20) stateTag = `<span class="tag tag-blue">❄️ 极度冰点 (孕育反弹机会)</span>`;
    else if (heatPct >= 60) stateTag = `<span class="tag tag-gold">温和走强活跃</span>`;

    detailBox.style.display = "block";
    detailBox.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid #334155; padding-bottom:8px;">
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:16px; font-weight:800; color:#38bdf8;">📍 【${targetPoint.date}】情绪点位历史百分位深度分析</span>
                <span style="font-size:12px; color:#94a3b8; background:rgba(56,189,248,0.12); padding:2px 8px; border-radius:4px; border:1px solid rgba(56,189,248,0.25);">
                    相对横轴周期: ${rangeInfo.yearRangeText} (${rangeInfo.startDate} ~ ${rangeInfo.endDate})
                </span>
                ${stateTag}
            </div>
            <button onclick="document.getElementById('heat-point-detail-box').style.display='none'" style="background:none; border:none; color:#94a3b8; font-size:16px; cursor:pointer;">✕</button>
        </div>
        <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:12px;">
            <div style="background:rgba(30,41,59,0.7); padding:10px 12px; border-radius:6px; border-left:3px solid #ef4444;">
                <div style="font-size:11px; color:#94a3b8;">综合热度指数</div>
                <div style="font-size:20px; font-weight:800; color:#ef4444; margin:3px 0;">${targetPoint.heat_index}</div>
                <div style="font-size:12px; color:#cbd5e1;">横轴历史百分位: <b style="color:#f59e0b; font-size:13px;">${heatPct}%</b></div>
                <div style="font-size:11px; color:#64748b; margin-top:2px;">横轴区间极值: ${heatMinMax.min} ~ ${heatMinMax.max}</div>
            </div>
            <div style="background:rgba(30,41,59,0.7); padding:10px 12px; border-radius:6px; border-left:3px solid #f59e0b;">
                <div style="font-size:11px; color:#94a3b8;">交投量能热度分</div>
                <div style="font-size:20px; font-weight:800; color:#f59e0b; margin:3px 0;">${targetPoint.volume_score}</div>
                <div style="font-size:12px; color:#cbd5e1;">横轴量能分位数: <b style="color:#f59e0b; font-size:13px;">${volPct}%</b></div>
                <div style="font-size:11px; color:#64748b; margin-top:2px;">横轴区间极值: ${volMinMax.min} ~ ${volMinMax.max}</div>
            </div>
            <div style="background:rgba(30,41,59,0.7); padding:10px 12px; border-radius:6px; border-left:3px solid #10b981;">
                <div style="font-size:11px; color:#94a3b8;">赚钱效应得分</div>
                <div style="font-size:20px; font-weight:800; color:#10b981; margin:3px 0;">${targetPoint.price_score}</div>
                <div style="font-size:12px; color:#cbd5e1;">横轴效应分位数: <b style="color:#f59e0b; font-size:13px;">${pricePct}%</b></div>
                <div style="font-size:11px; color:#64748b; margin-top:2px;">横轴区间极值: ${priceMinMax.min} ~ ${priceMinMax.max}</div>
            </div>
            <div style="background:rgba(30,41,59,0.7); padding:10px 12px; border-radius:6px; border-left:3px solid #38bdf8;">
                <div style="font-size:11px; color:#94a3b8;">上证指数点位</div>
                <div style="font-size:20px; font-weight:800; color:#38bdf8; margin:3px 0;">${targetPoint.index_close ? targetPoint.index_close.toFixed(2) : '--'}</div>
                <div style="font-size:12px; color:#cbd5e1;">横轴指数分位数: <b style="color:#38bdf8; font-size:13px;">${indexPct}%</b></div>
                <div style="font-size:11px; color:#64748b; margin-top:2px;">横轴区间极值: ${indexMinMax.min} ~ ${indexMinMax.max}</div>
            </div>
        </div>
    `;
}

// 渲染全市场历史热度 ECharts 交互时序图
function renderMarketHeatChart(history) {
    const chartDom = document.getElementById('market-heat-chart');
    if (!chartDom) return;

    if (!marketHeatChartInstance) {
        marketHeatChartInstance = echarts.init(chartDom, 'dark');
        window.addEventListener('resize', () => marketHeatChartInstance.resize());
    }

    const dates = history.map(h => h.date);
    const heatScores = history.map(h => h.heat_index);
    const volScores = history.map(h => h.volume_score);
    const indexPrices = history.map(h => h.index_close);

    const initialRangeInfo = getVisibleMarketHeatDateRange();
    const badge = document.getElementById("heat-chart-range-badge");
    if (badge) {
        badge.innerText = `(${initialRangeInfo.yearRangeText})`;
    }

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'cross' },
            formatter: (params) => {
                const dateStr = params[0].axisValue;
                const range = getVisibleMarketHeatDateRange();
                let tip = `<div style="font-weight:bold;margin-bottom:6px;color:#38bdf8;border-bottom:1px solid #334155;padding-bottom:4px;">
                    📅 ${dateStr} 市场情绪 <span style="font-size:11px;color:#94a3b8;font-weight:normal;">(${range.yearRangeText})</span>
                </div>`;
                
                // 查找该日期点位计算横轴相对百分位
                const visible = currentMarketHeatHistory.slice(range.startIndex, range.endIndex + 1);
                const curPoint = currentMarketHeatHistory.find(h => h.date === dateStr);
                let heatPercentile = '--';
                if (curPoint && visible.length > 0) {
                    const cnt = visible.filter(v => v.heat_index <= curPoint.heat_index).length;
                    heatPercentile = (Math.round((cnt / visible.length) * 1000) / 10) + '%';
                }

                params.forEach(p => {
                    tip += `<div style="display:flex;justify-content:space-between;gap:14px;margin:2px 0;">
                        <span>${p.marker} ${p.seriesName}:</span>
                        <b>${p.value}</b>
                    </div>`;
                });
                tip += `<div style="font-size:11px;color:#f59e0b;margin-top:4px;">横轴热度百分位: <b>${heatPercentile}</b> (点击点位锁定深度对比)</div>`;
                return tip;
            }
        },
        legend: {
            data: ['全市场综合热度', '量能活跃度', '上证指数基准'],
            top: '0%',
            right: '2%',
            textStyle: { color: '#cbd5e1' }
        },
        grid: { left: '3%', right: '4%', bottom: '12%', top: '12%', containLabel: true },
        xAxis: {
            type: 'category',
            data: dates,
            axisLabel: { interval: 'auto' }
        },
        yAxis: [
            {
                type: 'value',
                name: '热度指数 (0-100)',
                min: 0,
                max: 100,
                splitLine: { lineStyle: { color: '#233152' } }
            },
            {
                type: 'value',
                name: '上证指数',
                scale: true,
                splitLine: { show: false }
            }
        ],
        dataZoom: [
            {
                type: 'inside',
                xAxisIndex: 0,
                start: 0,
                end: 100,
                zoomOnMouseWheel: true,
                moveOnMouseMove: true,
                filterMode: 'filter'
            },
            {
                type: 'slider',
                xAxisIndex: 0,
                bottom: '1%',
                height: 24,
                start: 0,
                end: 100,
                borderColor: '#334155',
                fillerColor: 'rgba(56, 189, 248, 0.25)',
                handleStyle: { color: '#38bdf8' },
                textStyle: { color: '#94a3b8' },
                filterMode: 'filter'
            }
        ],
        series: [
            {
                name: '全市场综合热度',
                type: 'line',
                data: heatScores,
                smooth: true,
                showSymbol: false,
                lineStyle: { width: 3, color: '#ef4444' },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(239, 68, 68, 0.45)' },
                        { offset: 1, color: 'rgba(239, 68, 68, 0.02)' }
                    ])
                },
                markLine: {
                    silent: true,
                    data: [
                        { yAxis: 80, lineStyle: { color: '#ef4444', type: 'dashed' }, label: { formatter: '高潮区 (80)' } },
                        { yAxis: 50, lineStyle: { color: '#f59e0b', type: 'dashed' }, label: { formatter: '平衡中轴 (50)' } },
                        { yAxis: 30, lineStyle: { color: '#3b82f6', type: 'dashed' }, label: { formatter: '低迷冰点 (30)' } }
                    ]
                }
            },
            {
                name: '量能活跃度',
                type: 'line',
                data: volScores,
                smooth: true,
                showSymbol: false,
                lineStyle: { width: 1.5, color: '#f59e0b', type: 'dotted' }
            },
            {
                name: '上证指数基准',
                type: 'line',
                yAxisIndex: 1,
                data: indexPrices,
                smooth: true,
                showSymbol: false,
                lineStyle: { width: 1.5, color: '#38bdf8' }
            }
        ]
    };

    marketHeatChartInstance.setOption(option, true);

    // 绑定 dataZoom 拖动事件：更新徽章与已打开的点位百分比
    marketHeatChartInstance.off('dataZoom');
    let heatZoomTimer = null;
    marketHeatChartInstance.on('dataZoom', function (params) {
        clearTimeout(heatZoomTimer);
        heatZoomTimer = setTimeout(() => {
            let startVal = undefined, endVal = undefined;
            if (params) {
                if (params.batch && params.batch.length > 0) {
                    startVal = params.batch[0].start;
                    endVal = params.batch[0].end;
                } else if (params.start !== undefined && params.end !== undefined) {
                    startVal = params.start;
                    endVal = params.end;
                }
            }
            const rangeInfo = getVisibleMarketHeatDateRange(startVal, endVal);
            const b = document.getElementById("heat-chart-range-badge");
            if (b) {
                b.innerText = `(${rangeInfo.yearRangeText})`;
            }
            // 如果下方百分比详情卡片已处于展开状态，联动重算当前选定点位的新区间百分位
            const detailBox = document.getElementById("heat-point-detail-box");
            if (detailBox && detailBox.style.display !== 'none') {
                const titleMatch = detailBox.innerText.match(/【(.*?)】/);
                if (titleMatch && titleMatch[1]) {
                    showMarketHeatPointDetail(titleMatch[1]);
                }
            }
        }, 30);
    });

    // 绑定点击事件：点击任意点位，计算并显示该时点相对当前横轴区间的百分位分析
    marketHeatChartInstance.off('click');
    marketHeatChartInstance.on('click', function (params) {
        const pointDate = params.name || (dates && dates[params.dataIndex]);
        if (pointDate) {
            showMarketHeatPointDetail(pointDate);
        }
    });
}

// ==========================================
// 0.5 果仁网大盘情绪温度计与量化择时模型
// ==========================================
async function loadGuornSentiment() {
    try {
        const res = await fetch(`/api/guorn/sentiment?index_code=${currentGuornIndexCode}&period=${currentGuornPeriod}`);
        const json = await res.json();
        if (json.status !== "success") return;

        const lat = json.latest || {};
        const factors = lat.factors || {};

        // 顶部徽章更新
        document.getElementById("guorn-current-temp-tag").innerText = `情绪温度: ${lat.sentiment_temperature || '--'}°`;
        document.getElementById("guorn-position-tag").innerText = `建议仓位: ${lat.position_recommendation || 0}% (${lat.timing_signal || '观察'})`;
        
        // 关键指标卡片更新
        document.getElementById("guorn-metric-temp-val").innerText = `${lat.sentiment_temperature || '--'}°`;
        document.getElementById("guorn-metric-temp-level").innerText = lat.temperature_level || '';
        document.getElementById("guorn-metric-pos-val").innerText = `${lat.position_recommendation || 0}%`;
        document.getElementById("guorn-metric-sig-text").innerText = `择时: ${lat.timing_signal || '--'}`;
        document.getElementById("guorn-metric-bias-val").innerText = `${lat.bias_20d >= 0 ? '+' : ''}${lat.bias_20d || 0}%`;
        document.getElementById("guorn-metric-trend-val").innerText = lat.trend_status || 'MA20对比';
        document.getElementById("guorn-metric-macd-val").innerText = factors.macd_momentum_score || '--';
        document.getElementById("guorn-metric-macd-signal").innerText = lat.macd_signal || '动量分析';
        document.getElementById("guorn-metric-vol-val").innerText = `${lat.volatility_20d || '--'}%`;
        document.getElementById("guorn-metric-ret-val").innerText = `20D收益: ${lat.return_20d >= 0 ? '+' : ''}${lat.return_20d || 0}%`;

        currentGuornHistory = json.history || [];
        renderGuornSentimentChart(currentGuornHistory, json.index_name);
    } catch (e) {
        console.error("加载果仁网大盘情绪择时数据失败:", e);
    }
}

// 切换果仁择时标的指数 (sh000001, sh000300, sz399006, sh000905)
function switchGuornIndex(code) {
    currentGuornIndexCode = code;
    const indices = ["sh000001", "sh000300", "sz399006", "sh000905"];
    indices.forEach(idx => {
        const btn = document.getElementById("guorn-idx-" + idx);
        if (btn) btn.className = (idx === code) ? "chart-tab-btn active" : "chart-tab-btn";
    });
    loadGuornSentiment();
}

// 切换果仁周期 (day, week, month)
function switchGuornPeriod(period) {
    currentGuornPeriod = period;
    const periods = ["day", "week", "month"];
    periods.forEach(p => {
        const btn = document.getElementById("guorn-period-" + p);
        if (btn) btn.className = (p === period) ? "chart-tab-btn active" : "chart-tab-btn";
    });
    loadGuornSentiment();
}

// 快捷缩放果仁时间轴 (半年, 1年, 3年, 全部)
function zoomGuornFast(type) {
    if (!guornSentimentChartInstance || !currentGuornHistory || currentGuornHistory.length === 0) return;
    const total = currentGuornHistory.length;
    let count = total;
    if (currentGuornPeriod === 'day') {
        if (type === 'half_year') count = 125;
        else if (type === '1_year') count = 250;
        else if (type === '3_year') count = 750;
    } else if (currentGuornPeriod === 'week') {
        if (type === 'half_year') count = 26;
        else if (type === '1_year') count = 52;
        else if (type === '3_year') count = 156;
    } else {
        if (type === 'half_year') count = 6;
        else if (type === '1_year') count = 12;
        else if (type === '3_year') count = 36;
    }

    let start = 0;
    if (type !== 'all' && total > count) {
        start = Math.max(0, Math.round(((total - count) / total) * 100));
    }

    guornSentimentChartInstance.dispatchAction({
        type: 'dataZoom',
        start: start,
        end: 100
    });
}

// 获取当前果仁横轴可见时间区间信息
function getVisibleGuornDateRange(explicitStart, explicitEnd) {
    if (!currentGuornHistory || currentGuornHistory.length === 0) {
        return { startIndex: 0, endIndex: 0, startDate: '', endDate: '', yearRangeText: '择时区间' };
    }
    const dates = currentGuornHistory.map(h => h.date);
    let startIndex = 0;
    let endIndex = dates.length - 1;

    if (explicitStart !== undefined && explicitEnd !== undefined) {
        startIndex = Math.max(0, Math.min(dates.length - 1, Math.floor((explicitStart / 100) * (dates.length - 1))));
        endIndex = Math.max(startIndex, Math.min(dates.length - 1, Math.ceil((explicitEnd / 100) * (dates.length - 1))));
    } else if (guornSentimentChartInstance) {
        const opt = guornSentimentChartInstance.getOption();
        if (opt && opt.dataZoom && opt.dataZoom.length > 0) {
            const dz = opt.dataZoom[0];
            if (dz.startValue !== undefined && typeof dz.startValue === 'number' && dz.startValue >= 0) {
                startIndex = Math.max(0, Math.min(dates.length - 1, Math.round(dz.startValue)));
                endIndex = Math.max(startIndex, Math.min(dates.length - 1, Math.round(dz.endValue)));
            } else if (dz.start !== undefined && dz.end !== undefined) {
                startIndex = Math.max(0, Math.min(dates.length - 1, Math.floor((dz.start / 100) * (dates.length - 1))));
                endIndex = Math.max(startIndex, Math.min(dates.length - 1, Math.ceil((dz.end / 100) * (dates.length - 1))));
            }
        }
    }

    const startDate = dates[startIndex] || '';
    const endDate = dates[endIndex] || '';
    const startYearMatch = String(startDate).match(/^(\d{4})/);
    const endYearMatch = String(endDate).match(/^(\d{4})/);
    const startYear = startYearMatch ? startYearMatch[1] : '';
    const endYear = endYearMatch ? endYearMatch[1] : '';

    let yearRangeText = "";
    if (startYear && endYear) {
        yearRangeText = (startYear === endYear) ? `${startYear}年` : `${startYear}年至${endYear}年`;
    } else if (startYear || endYear) {
        yearRangeText = `${startYear || endYear}年`;
    } else {
        yearRangeText = "择时区间";
    }

    return { startIndex, endIndex, startDate, endDate, startYear, endYear, yearRangeText };
}

// 点击任意果仁点位，计算该时点相对当前横轴区间的百分位分析
function showGuornPointDetail(pointDate) {
    const detailBox = document.getElementById("guorn-point-detail-box");
    if (!detailBox || !currentGuornHistory || currentGuornHistory.length === 0) return;

    const rangeInfo = getVisibleGuornDateRange();
    const visiblePoints = currentGuornHistory.slice(rangeInfo.startIndex, rangeInfo.endIndex + 1);
    if (visiblePoints.length === 0) return;

    const targetPoint = currentGuornHistory.find(h => h.date === pointDate) || visiblePoints[visiblePoints.length - 1];
    if (!targetPoint) return;

    // 计算横轴百分位数
    const tempValues = visiblePoints.map(p => p.temperature);
    const posValues = visiblePoints.map(p => p.position);
    const closeValues = visiblePoints.map(p => p.close);

    const calcPct = (arr, val) => {
        if (!arr || arr.length === 0 || val === undefined || val === null) return 50.0;
        const count = arr.filter(v => v <= val).length;
        return (Math.round((count / arr.length) * 1000) / 10).toFixed(1);
    };

    const tempPct = calcPct(tempValues, targetPoint.temperature);
    const posPct = calcPct(posValues, targetPoint.position);
    const closePct = calcPct(closeValues, targetPoint.close);

    const minTemp = Math.min(...tempValues).toFixed(1);
    const maxTemp = Math.max(...tempValues).toFixed(1);
    const minClose = Math.min(...closeValues).toFixed(1);
    const maxClose = Math.max(...closeValues).toFixed(1);

    detailBox.style.display = "block";
    detailBox.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid #334155; padding-bottom:8px;">
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:16px; font-weight:800; color:#10b981;">📍 【${targetPoint.date}】果仁网多因子情绪择时切片分析</span>
                <span style="font-size:12px; color:#94a3b8; background:rgba(16,185,129,0.12); padding:2px 8px; border-radius:4px; border:1px solid rgba(16,185,129,0.25);">
                    横轴区间: ${rangeInfo.yearRangeText} (${rangeInfo.startDate} ~ ${rangeInfo.endDate})
                </span>
                <span class="tag tag-gold">择时信号: ${targetPoint.signal}</span>
            </div>
            <button onclick="document.getElementById('guorn-point-detail-box').style.display='none'" style="background:none; border:none; color:#94a3b8; font-size:16px; cursor:pointer;">✕</button>
        </div>
        <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:12px;">
            <div style="background:rgba(30,41,59,0.7); padding:10px 12px; border-radius:6px; border-left:3px solid #10b981;">
                <div style="font-size:11px; color:#94a3b8;">果仁情绪温度</div>
                <div style="font-size:20px; font-weight:800; color:#10b981; margin:3px 0;">${targetPoint.temperature}°</div>
                <div style="font-size:12px; color:#cbd5e1;">横轴历史百分位: <b style="color:#f59e0b; font-size:13px;">${tempPct}%</b></div>
                <div style="font-size:11px; color:#64748b; margin-top:2px;">区间极值: ${minTemp}° ~ ${maxTemp}°</div>
            </div>
            <div style="background:rgba(30,41,59,0.7); padding:10px 12px; border-radius:6px; border-left:3px solid #f59e0b;">
                <div style="font-size:11px; color:#94a3b8;">建议择时仓位</div>
                <div style="font-size:20px; font-weight:800; color:#f59e0b; margin:3px 0;">${targetPoint.position}%</div>
                <div style="font-size:12px; color:#cbd5e1;">仓位分位数: <b style="color:#f59e0b; font-size:13px;">${posPct}%</b></div>
                <div style="font-size:11px; color:#64748b; margin-top:2px;">执行策略: ${targetPoint.signal}</div>
            </div>
            <div style="background:rgba(30,41,59,0.7); padding:10px 12px; border-radius:6px; border-left:3px solid #38bdf8;">
                <div style="font-size:11px; color:#94a3b8;">基准指数点位</div>
                <div style="font-size:20px; font-weight:800; color:#38bdf8; margin:3px 0;">${targetPoint.close.toFixed(2)}</div>
                <div style="font-size:12px; color:#cbd5e1;">指数点位分位数: <b style="color:#38bdf8; font-size:13px;">${closePct}%</b></div>
                <div style="font-size:11px; color:#64748b; margin-top:2px;">区间极值: ${minClose} ~ ${maxClose}</div>
            </div>
            <div style="background:rgba(30,41,59,0.7); padding:10px 12px; border-radius:6px; border-left:3px solid #a855f7;">
                <div style="font-size:11px; color:#94a3b8;">核心因子打分</div>
                <div style="font-size:12px; color:#cbd5e1; margin-top:4px;">均线趋势: <b style="color:#10b981">${targetPoint.trend_score || '--'}</b></div>
                <div style="font-size:12px; color:#cbd5e1;">MACD动能: <b style="color:#ef4444">${targetPoint.macd_score || '--'}</b></div>
                <div style="font-size:12px; color:#cbd5e1;">量能活跃: <b style="color:#f59e0b">${targetPoint.volume_score || '--'}</b></div>
            </div>
        </div>
    `;
}

// 渲染果仁网大盘情绪温度与量化择时曲线
function renderGuornSentimentChart(history, indexName) {
    const chartDom = document.getElementById('guorn-sentiment-chart');
    if (!chartDom) return;

    if (!guornSentimentChartInstance) {
        guornSentimentChartInstance = echarts.init(chartDom, 'dark');
        window.addEventListener('resize', () => guornSentimentChartInstance.resize());
    }

    const dates = history.map(h => h.date);
    const temps = history.map(h => h.temperature);
    const positions = history.map(h => h.position);
    const closes = history.map(h => h.close);

    const initialRangeInfo = getVisibleGuornDateRange();
    const badge = document.getElementById("guorn-chart-range-badge");
    if (badge) {
        badge.innerText = `(${initialRangeInfo.yearRangeText})`;
    }

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'cross' },
            formatter: (params) => {
                const dateStr = params[0].axisValue;
                const range = getVisibleGuornDateRange();
                let tip = `<div style="font-weight:bold;margin-bottom:6px;color:#34d399;border-bottom:1px solid #334155;padding-bottom:4px;">
                    📅 ${dateStr} 果仁量化择时切片 <span style="font-size:11px;color:#94a3b8;font-weight:normal;">(${range.yearRangeText})</span>
                </div>`;
                
                const curPoint = currentGuornHistory.find(h => h.date === dateStr);
                const visible = currentGuornHistory.slice(range.startIndex, range.endIndex + 1);
                let tempPct = '--';
                if (curPoint && visible.length > 0) {
                    const cnt = visible.filter(v => v.temperature <= curPoint.temperature).length;
                    tempPct = (Math.round((cnt / visible.length) * 1000) / 10) + '%';
                }

                params.forEach(p => {
                    tip += `<div style="display:flex;justify-content:space-between;gap:14px;margin:2px 0;">
                        <span>${p.marker} ${p.seriesName}:</span>
                        <b>${p.value}${p.seriesName.includes('仓位') ? '%' : (p.seriesName.includes('温度') ? '°' : '')}</b>
                    </div>`;
                });
                if (curPoint) {
                    tip += `<div style="font-size:11px;color:#f59e0b;margin-top:4px;">择时信号: <b>${curPoint.signal}</b> (横轴温度百分位: <b>${tempPct}</b>)</div>`;
                }
                return tip;
            }
        },
        legend: {
            data: ['果仁情绪温度', '量化建议仓位', `${indexName || '基准指数'}走势`],
            top: '0%',
            right: '2%',
            textStyle: { color: '#cbd5e1' }
        },
        grid: { left: '3%', right: '4%', bottom: '12%', top: '12%', containLabel: true },
        xAxis: {
            type: 'category',
            data: dates,
            axisLabel: { interval: 'auto' }
        },
        yAxis: [
            {
                type: 'value',
                name: '情绪温度 / 仓位 (%)',
                min: 0,
                max: 100,
                splitLine: { lineStyle: { color: '#1f2937' } }
            },
            {
                type: 'value',
                name: `${indexName || '指数'}`,
                scale: true,
                splitLine: { show: false }
            }
        ],
        dataZoom: [
            {
                type: 'inside',
                xAxisIndex: 0,
                start: 0,
                end: 100,
                zoomOnMouseWheel: true,
                moveOnMouseMove: true,
                filterMode: 'filter'
            },
            {
                type: 'slider',
                xAxisIndex: 0,
                bottom: '1%',
                height: 24,
                start: 0,
                end: 100,
                borderColor: '#064e3b',
                fillerColor: 'rgba(16, 185, 129, 0.25)',
                handleStyle: { color: '#10b981' },
                textStyle: { color: '#94a3b8' },
                filterMode: 'filter'
            }
        ],
        series: [
            {
                name: '果仁情绪温度',
                type: 'line',
                data: temps,
                smooth: true,
                showSymbol: false,
                lineStyle: { width: 3, color: '#10b981' },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(16, 185, 129, 0.40)' },
                        { offset: 1, color: 'rgba(16, 185, 129, 0.02)' }
                    ])
                },
                markLine: {
                    silent: true,
                    data: [
                        { yAxis: 85, lineStyle: { color: '#ef4444', type: 'dashed' }, label: { formatter: '过热减仓 (85°)' } },
                        { yAxis: 70, lineStyle: { color: '#10b981', type: 'dashed' }, label: { formatter: '进攻区 (70°)' } },
                        { yAxis: 35, lineStyle: { color: '#3b82f6', type: 'dashed' }, label: { formatter: '冰点试仓 (35°)' } }
                    ]
                }
            },
            {
                name: '量化建议仓位',
                type: 'line',
                step: 'start',
                data: positions,
                showSymbol: false,
                lineStyle: { width: 2, color: '#f59e0b', type: 'dashed' }
            },
            {
                name: `${indexName || '基准指数'}走势`,
                type: 'line',
                yAxisIndex: 1,
                data: closes,
                smooth: true,
                showSymbol: false,
                lineStyle: { width: 1.5, color: '#38bdf8' }
            }
        ]
    };

    guornSentimentChartInstance.setOption(option, true);

    // 绑定 dataZoom 拖拽事件
    guornSentimentChartInstance.off('dataZoom');
    let guornZoomTimer = null;
    guornSentimentChartInstance.on('dataZoom', function (params) {
        clearTimeout(guornZoomTimer);
        guornZoomTimer = setTimeout(() => {
            let startVal = undefined, endVal = undefined;
            if (params) {
                if (params.batch && params.batch.length > 0) {
                    startVal = params.batch[0].start;
                    endVal = params.batch[0].end;
                } else if (params.start !== undefined && params.end !== undefined) {
                    startVal = params.start;
                    endVal = params.end;
                }
            }
            const rangeInfo = getVisibleGuornDateRange(startVal, endVal);
            const b = document.getElementById("guorn-chart-range-badge");
            if (b) {
                b.innerText = `(${rangeInfo.yearRangeText})`;
            }
            const detailBox = document.getElementById("guorn-point-detail-box");
            if (detailBox && detailBox.style.display !== 'none') {
                const titleMatch = detailBox.innerText.match(/【(.*?)】/);
                if (titleMatch && titleMatch[1]) {
                    showGuornPointDetail(titleMatch[1]);
                }
            }
        }, 30);
    });

    // 绑定点击事件：点击任意点位展开择时模型切片
    guornSentimentChartInstance.off('click');
    guornSentimentChartInstance.on('click', function (params) {
        const pointDate = params.name || (dates && dates[params.dataIndex]);
        if (pointDate) {
            showGuornPointDetail(pointDate);
        }
    });
}

// ==========================================
// 0.6 果仁网【市场风向标】(Guorn Market Wind Vane)
// ==========================================
async function loadGuornMarketVane() {
    try {
        const res = await fetch("/api/guorn/market_vane");
        const json = await res.json();
        if (json.status !== "success" || !json.vane) return;

        const v = json.vane;

        // 徽章与标签更新
        const intBadge = document.getElementById("guorn-vane-intensity-badge");
        if (intBadge) {
            intBadge.innerText = `市场强度: ${v.market_intensity > 0 ? '+' : ''}${v.market_intensity} (${v.intensity_state})`;
        }
        const dirBadge = document.getElementById("guorn-vane-direction-badge");
        if (dirBadge) {
            dirBadge.innerText = `日内风向: ${v.intraday_direction}`;
        }

        // 3大雷达卡片
        const intScore = document.getElementById("vane-intensity-score");
        if (intScore) {
            intScore.innerText = `${v.market_intensity > 0 ? '+' : ''}${v.market_intensity}`;
            intScore.style.color = v.market_intensity >= 0 ? '#c084fc' : '#94a3b8';
        }
        const intState = document.getElementById("vane-intensity-state");
        if (intState) intState.innerText = v.intensity_state;

        const sizeStyle = document.getElementById("vane-size-style");
        if (sizeStyle) sizeStyle.innerText = v.size_style;
        const sizeDiff = document.getElementById("vane-size-diff");
        if (sizeDiff) sizeDiff.innerText = `300 vs 500利差: ${v.size_diff >= 0 ? '+' : ''}${v.size_diff}%`;
        const sizeDesc = document.getElementById("vane-size-desc");
        if (sizeDesc) sizeDesc.innerText = v.size_desc;

        const growthStyle = document.getElementById("vane-growth-style");
        if (growthStyle) growthStyle.innerText = v.growth_style;
        const growthDiff = document.getElementById("vane-growth-diff");
        if (growthDiff) growthDiff.innerText = `创指 vs 300利差: ${v.growth_diff >= 0 ? '+' : ''}${v.growth_diff}%`;
        const growthDesc = document.getElementById("vane-growth-desc");
        if (growthDesc) growthDesc.innerText = v.growth_desc;

        // 解禁风控卡片
        if (v.lockup_summary) {
            const lk = v.lockup_summary;
            const riskDom = document.getElementById("vane-lockup-risk");
            const amtDom = document.getElementById("vane-lockup-amt");
            const descDom = document.getElementById("vane-lockup-desc");
            if (riskDom) riskDom.innerText = `风险: ${lk.risk_level}`;
            if (amtDom) amtDom.innerText = `周解禁: ${lk.weekly_lockup_amount} 亿`;
            if (descDom) descDom.innerText = lk.risk_desc;
        }

        // 因子 IC 矩阵表格渲染
        const tbody = document.getElementById("guorn-factors-ic-tbody");
        if (tbody && v.factors_ic) {
            let html = "";
            v.factors_ic.forEach(f => {
                const isHigh = f.rank_ic >= 0.06;
                const statusColor = isHigh ? '#10b981' : (f.rank_ic >= 0.03 ? '#38bdf8' : '#94a3b8');
                html += `
                <tr>
                    <td><b style="color:#e2e8f0">${f.factor_name}</b></td>
                    <td><span class="tag tag-gold">${f.category}</span></td>
                    <td><b style="color:${statusColor}">${f.rank_ic.toFixed(3)}</b></td>
                    <td>${f.ic_ir.toFixed(2)}</td>
                    <td><span style="color:#f59e0b; font-weight:700">${f.win_rate}%</span></td>
                    <td><span class="tag ${isHigh ? 'tag-green' : 'tag-blue'}">${f.status}</span></td>
                    <td style="color:#cbd5e1; font-size:12px;">${f.desc}</td>
                </tr>`;
            });
            tbody.innerHTML = html;
        }

        // 宽基指数估值与景气分位表格
        const idxValTbody = document.getElementById("guorn-index-val-tbody");
        if (idxValTbody && v.index_valuations) {
            let html = "";
            v.index_valuations.forEach(idx => {
                const isLowVal = idx.pe_percentile <= 35;
                html += `
                <tr>
                    <td><b style="color:#38bdf8">${idx.index_name}</b></td>
                    <td><b style="color:#ef4444">${idx.pe_ttm}</b></td>
                    <td><span class="tag ${isLowVal ? 'tag-green' : 'tag-gold'}">${idx.pe_percentile}%</span></td>
                    <td><b style="color:#f59e0b">${idx.pb}</b></td>
                    <td><span style="color:#10b981">${idx.dividend_yield}%</span></td>
                    <td><span style="color:#cbd5e1">${idx.prosperity}</span></td>
                </tr>`;
            });
            idxValTbody.innerHTML = html;
        }

        // 重点行业因子倾向与景气度表格
        const indFactorTbody = document.getElementById("guorn-industry-factors-tbody");
        if (indFactorTbody && v.industry_factors) {
            let html = "";
            v.industry_factors.forEach(ind => {
                html += `
                <tr>
                    <td><b style="color:#a855f7">${ind.industry_name}</b></td>
                    <td><b style="color:#ef4444">${ind.heat_score}</b></td>
                    <td><span class="tag tag-blue">${ind.factor_bias}</span></td>
                    <td><span style="color:#38bdf8">${ind.trend}</span></td>
                    <td>${ind.pe_ttm}</td>
                    <td><span class="tag tag-gold">${ind.status}</span></td>
                </tr>`;
            });
            indFactorTbody.innerHTML = html;
        }
        // 渲染官方模式：果仁强度指标趋势图与表格摘要
        if (json.intensity_history) {
            currentGuornIntensityHistory = json.intensity_history;
            renderGuornIntensityChart(currentGuornIntensityHistory);
        }

        if (json.latest_intensity) {
            const li = json.latest_intensity;
            const domainNameMap = { all: "全市场", hs300: "沪深300", zz500: "中证500", cyb: "创业板" };
            const domLabel = document.getElementById("guorn-table-domain-label");
            const intValDom = document.getElementById("guorn-table-intensity-val");
            const stateValDom = document.getElementById("guorn-table-state-val");
            const latestDateLabel = document.getElementById("guorn-vane-latest-date-label");

            if (domLabel) domLabel.innerText = domainNameMap[json.domain] || "全市场";
            if (intValDom) {
                intValDom.innerText = (li.intensity >= 0 ? '+' : '') + li.intensity.toFixed(2);
                intValDom.style.color = li.intensity >= 0 ? '#ef4444' : '#10b981';
            }
            if (stateValDom) {
                stateValDom.innerText = li.state;
                stateValDom.style.color = li.state === '牛市' ? '#ef4444' : '#10b981';
            }
            if (latestDateLabel) {
                latestDateLabel.innerText = `(最新数据日期: ${li.date})`;
            }
        }
    } catch (e) {
        console.error("加载果仁市场风向标失败:", e);
    }
}

// 切换果仁强度指标投资域 (全市场, 沪深300, 中证500, 创业板)
function switchGuornIntensityDomain(domain) {
    currentGuornDomain = domain;
    loadGuornMarketVane();
}

// 快捷缩放果仁强度时间轴 (1个月, 3个月, 6个月, 1年, 2年, 全部)
function zoomGuornIntensityFast(type) {
    if (!guornIntensityChartInstance || !currentGuornIntensityHistory || currentGuornIntensityHistory.length === 0) return;
    const total = currentGuornIntensityHistory.length;
    let count = total;
    if (type === '1m') count = 22;
    else if (type === '3m') count = 66;
    else if (type === '6m') count = 125;
    else if (type === '1y') count = 250;
    else if (type === '2y') count = 500;
    else count = total;

    let start = 0;
    if (type !== 'all' && total > count) {
        start = Math.max(0, Math.round(((total - count) / total) * 100));
    }

    guornIntensityChartInstance.dispatchAction({
        type: 'dataZoom',
        start: start,
        end: 100
    });
}

// 渲染果仁网官网 1:1 经典模式：市场强度指标交互时序图 (0轴红线基准，上牛下熊)
function renderGuornIntensityChart(history) {
    const chartDom = document.getElementById('guorn-intensity-chart');
    if (!chartDom) return;

    if (!guornIntensityChartInstance) {
        guornIntensityChartInstance = echarts.init(chartDom, 'dark');
        window.addEventListener('resize', () => guornIntensityChartInstance.resize());
    }

    const dates = history.map(h => h.date);
    const intensities = history.map(h => h.intensity);

    // 默认展示近2年 (约500条)
    let defaultStart = 0;
    if (dates.length > 500) {
        defaultStart = Math.round(((dates.length - 500) / dates.length) * 100);
    }

    const startInput = document.getElementById("guorn-range-start-input");
    const endInput = document.getElementById("guorn-range-end-input");
    const startIndex = Math.floor((defaultStart / 100) * (dates.length - 1));
    if (startInput) startInput.value = dates[startIndex] || '';
    if (endInput) endInput.value = dates[dates.length - 1] || '';

    const option = {
        backgroundColor: '#0f172a',
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'cross' },
            formatter: (params) => {
                const p = params[0];
                const dateStr = p.axisValue;
                const val = parseFloat(p.value);
                const isBull = val >= 0;
                const stateText = isBull ? '<span style="color:#ef4444;font-weight:bold;">牛市</span>' : '<span style="color:#10b981;font-weight:bold;">熊市</span>';
                return `
                <div style="font-weight:bold;margin-bottom:4px;color:#cbd5e1;">${dateStr}</div>
                <div style="display:flex;justify-content:space-between;gap:12px;">
                    <span>全市场 果仁强度:</span>
                    <b style="color:${isBull ? '#ef4444' : '#10b981'}">${val >= 0 ? '+' : ''}${val.toFixed(2)}</b>
                </div>
                <div style="margin-top:2px;font-size:11px;color:#94a3b8;">市场状态: ${stateText} (以0轴为分界)</div>
                `;
            }
        },
        grid: { left: '3%', right: '4%', top: '8%', bottom: '26%', containLabel: true },
        xAxis: {
            type: 'category',
            data: dates,
            axisLine: { lineStyle: { color: '#334155' } },
            axisLabel: { color: '#94a3b8' }
        },
        yAxis: {
            type: 'value',
            scale: true,
            splitLine: { lineStyle: { color: '#1e293b' } },
            axisLabel: {
                color: '#94a3b8',
                formatter: (val) => val.toFixed(2)
            }
        },
        dataZoom: [
            {
                type: 'inside',
                xAxisIndex: 0,
                start: defaultStart,
                end: 100,
                filterMode: 'filter'
            },
            {
                type: 'slider',
                xAxisIndex: 0,
                bottom: '2%',
                height: 48,
                start: defaultStart,
                end: 100,
                borderColor: '#334155',
                fillerColor: 'rgba(37, 99, 235, 0.25)',
                handleStyle: { color: '#38bdf8' },
                textStyle: { color: '#94a3b8' },
                filterMode: 'filter'
            }
        ],
        series: [
            {
                name: '全市场 果仁强度',
                type: 'line',
                data: intensities,
                smooth: true,
                showSymbol: false,
                lineStyle: { width: 2, color: '#3b82f6' },
                markLine: {
                    silent: true,
                    symbol: 'none',
                    data: [
                        {
                            yAxis: 0,
                            lineStyle: { color: '#ef4444', width: 1.5, type: 'solid' },
                            label: {
                                show: true,
                                position: 'insideEndTop',
                                formatter: '牛市',
                                color: '#ef4444',
                                fontSize: 13,
                                fontWeight: 'bold'
                            }
                        },
                        {
                            yAxis: 0,
                            lineStyle: { color: '#ef4444', width: 1.5, type: 'solid' },
                            label: {
                                show: true,
                                position: 'insideEndBottom',
                                formatter: '熊市',
                                color: '#10b981',
                                fontSize: 13,
                                fontWeight: 'bold'
                            }
                        }
                    ]
                }
            }
        ]
    };

    guornIntensityChartInstance.setOption(option, true);

    // 绑定 dataZoom 事件更新输入框日期
    guornIntensityChartInstance.off('dataZoom');
    guornIntensityChartInstance.on('dataZoom', function (params) {
        let s = defaultStart, e = 100;
        if (params.batch && params.batch.length > 0) {
            s = params.batch[0].start !== undefined ? params.batch[0].start : s;
            e = params.batch[0].end !== undefined ? params.batch[0].end : e;
        } else if (params.start !== undefined && params.end !== undefined) {
            s = params.start;
            e = params.end;
        }
        const sIdx = Math.max(0, Math.min(dates.length - 1, Math.floor((s / 100) * (dates.length - 1))));
        const eIdx = Math.max(0, Math.min(dates.length - 1, Math.ceil((e / 100) * (dates.length - 1))));
        const sDom = document.getElementById("guorn-range-start-input");
        const eDom = document.getElementById("guorn-range-end-input");
        if (sDom) sDom.value = dates[sIdx] || '';
        if (eDom) eDom.value = dates[eIdx] || '';
    });
}


// 1. 加载大盘指数与市场情绪
async function loadMarketOverview() {
    try {
        const res = await fetch("/api/market/overview");
        const json = await res.json();
        if (json.status !== "success") return;

        const indices = json.indices;
        const bar = document.getElementById("indices-bar");
        let html = "";

        indices.forEach(idx => {
            const isUp = idx.change_percent >= 0;
            const colorClass = isUp ? "tag-red" : "tag-green";
            const sign = isUp ? "+" : "";
            html += `
            <div class="index-card">
                <div class="index-name">${idx.name} (${idx.code})</div>
                <div class="index-val" style="color: ${isUp ? '#ef4444' : '#10b981'}">
                    ${idx.current_price.toFixed(2)}
                </div>
                <div class="index-meta">
                    <span class="tag ${colorClass}">${sign}${idx.change_percent.toFixed(2)}%</span>
                    <span style="color: #94a3b8">成交: ${(idx.amount / 10000).toFixed(1)}亿</span>
                </div>
            </div>`;
        });

        // 情绪总结框
        const s = json.market_sentiment;
        html += `
        <div class="sentiment-overview">
            <div style="font-size:12px; color:#94a3b8; display:flex; justify-content:space-between">
                <span>全市场交投统计</span>
                <span style="color:#f59e0b; font-weight:700">情绪指数: ${s.sentiment_index}</span>
            </div>
            <div style="display:flex; justify-content:space-around; margin: 4px 0; font-size:13px">
                <span style="color:#ef4444">涨 ${s.up_count}</span>
                <span style="color:#10b981">跌 ${s.down_count}</span>
                <span style="color:#f59e0b">涨停 ${s.limit_up_count}</span>
                <span style="color:#cbd5e1">总额 ${s.total_turnover_amount}亿</span>
            </div>
            <div style="font-size:11px; color:#38bdf8; background:rgba(0,0,0,0.25); padding:4px 8px; border-radius:4px">
                ${s.sentiment_desc}
            </div>
        </div>`;

        bar.innerHTML = html;
        document.getElementById("last-update-time").innerText = json.timestamp.split(" ")[1];
    } catch (e) {
        console.error("加载大盘概览失败:", e);
    }
}

// 2. 加载全市场总龙头与龙1/龙2梯队 (点击股票直接看K线/分时)
async function loadMarketLeaders() {
    try {
        const res = await fetch("/api/market/leaders");
        const json = await res.json();
        if (json.status !== "success" || !json.data) return;

        const container = document.getElementById("market-leaders-grid");
        let html = "";

        json.data.forEach(item => {
            let badgeClass = "badge-master";
            let typeLabel = "全市场总龙头";
            if (item.leader_type === "DRAGON_1") {
                badgeClass = "badge-dragon1";
                typeLabel = "全市场龙1 (进攻先锋)";
            } else if (item.leader_type === "DRAGON_2") {
                badgeClass = "badge-dragon2";
                typeLabel = "全市场龙2 (中军核心)";
            }

            html += `
            <div class="leader-item">
                <div class="leader-badge ${badgeClass}">${typeLabel}</div>
                <div class="leader-stock-title">
                    <a class="stock-link" onclick="openStockChartModal('${item.stock_code}', '${item.stock_name}')">${item.stock_name}</a>
                    <span style="font-size:13px; color:#94a3b8; font-weight:normal">(${item.stock_code})</span>
                </div>
                <div style="display:flex; gap:12px; margin: 6px 0; align-items:baseline">
                    <span style="font-size:22px; font-weight:700; color:#ef4444">¥${item.price.toFixed(2)}</span>
                    <span class="tag tag-red">+${item.change_percent.toFixed(2)}%</span>
                    <span class="tag tag-gold">${item.consecutive_boards} 连板</span>
                </div>
                <div style="font-size:12px; color:#94a3b8; display:flex; justify-content:space-between">
                    <span>归属: <b style="color:#e2e8f0">${item.sector_name}</b></span>
                    <span>换手率: <b style="color:#e2e8f0">${item.turnover_rate}%</b></span>
                    <span>首封: <b style="color:#38bdf8">${item.seal_time}</b></span>
                </div>
                <div class="leader-desc">${item.analysis}</div>
            </div>`;
        });

        container.innerHTML = html;
    } catch (e) {
        console.error("加载市场龙头失败:", e);
    }
}

// 2.5 加载全市场最热点个股榜单 (支持前200只股票，每页25个分页呈现，含人气原因)
let allHotStocksData = [];
let hotStocksCurrentPage = 1;
const HOT_STOCKS_PAGE_SIZE = 25;

async function loadMarketHotStocks() {
    try {
        const res = await fetch("/api/market/hot_stocks?limit=200");
        const json = await res.json();
        if (json.status !== "success" || !json.data) return;

        allHotStocksData = json.data;
        const totalTag = document.getElementById("hot-stocks-total-tag");
        if (totalTag) totalTag.innerText = `监控收录: ${allHotStocksData.length} 只`;

        renderHotStocksPage(hotStocksCurrentPage);
    } catch (e) {
        console.error("加载全市场热点个股榜单失败:", e);
    }
}

function renderHotStocksPage(page) {
    hotStocksCurrentPage = page;
    const tbody = document.getElementById("market-hot-stocks-tbody");
    if (!tbody) return;

    const total = allHotStocksData.length;
    const totalPages = Math.max(1, Math.ceil(total / HOT_STOCKS_PAGE_SIZE));
    if (hotStocksCurrentPage > totalPages) hotStocksCurrentPage = totalPages;
    if (hotStocksCurrentPage < 1) hotStocksCurrentPage = 1;

    const startIdx = (hotStocksCurrentPage - 1) * HOT_STOCKS_PAGE_SIZE;
    const pageData = allHotStocksData.slice(startIdx, startIdx + HOT_STOCKS_PAGE_SIZE);

    let html = "";
    pageData.forEach((s) => {
        const isUp = s.change_percent >= 0;
        const sign = isUp ? "+" : "";
        const chgColor = isUp ? "#ef4444" : "#10b981";

        // 热度徽章与火焰标记
        let rankBadge = `<span style="display:inline-block; width:26px; height:22px; line-height:22px; text-align:center; border-radius:4px; font-weight:700; font-size:12px; background:#334155; color:#cbd5e1;">${s.rank}</span>`;
        if (s.rank === 1) {
            rankBadge = `<span style="display:inline-block; width:26px; height:22px; line-height:22px; text-align:center; border-radius:4px; font-weight:700; font-size:12px; background:#ef4444; color:#fff;">🔥 1</span>`;
        } else if (s.rank === 2) {
            rankBadge = `<span style="display:inline-block; width:26px; height:22px; line-height:22px; text-align:center; border-radius:4px; font-weight:700; font-size:12px; background:#f97316; color:#fff;">2</span>`;
        } else if (s.rank === 3) {
            rankBadge = `<span style="display:inline-block; width:26px; height:22px; line-height:22px; text-align:center; border-radius:4px; font-weight:700; font-size:12px; background:#eab308; color:#0f172a;">3</span>`;
        }

        // 人气排名升降与榜单来源
        let trendHtml = `<span style="color:#94a3b8">- 持平</span>`;
        if (s.rank_change > 0) {
            trendHtml = `<span style="color:#ef4444; font-weight:700">▲ 提升 ${s.rank_change}</span>`;
        } else if (s.rank_change < 0) {
            trendHtml = `<span style="color:#10b981">▼ 下降 ${Math.abs(s.rank_change)}</span>`;
        }
        if (s.source_tag) {
            trendHtml += `<div style="font-size:11px; color:#64748b; margin-top:2px;">${s.source_tag}</div>`;
        }

        // 成交额格式化
        const amtStr = s.amount ? `${(s.amount / 10000).toFixed(2)} 亿` : '--';
        const mktCapStr = s.circ_market_cap ? `${s.circ_market_cap.toFixed(1)} 亿` : '--';
        const reasonText = s.hot_reason || '全网焦点风向标 · 交投高频热议';

        const secName = s.sector_name || '综合行业';
        const secCode = s.sector_code || '';
        const secLink = `<a class="stock-link" style="color:#38bdf8; font-weight:600; cursor:pointer;" onclick="openSectorByName('${secName}', '${secCode}')" title="点击查看【${secName}】板块内全部股票与详情">${secName}</a>`;

        let reasonHtml = reasonText;
        const tagMatch = reasonText.match(/^【(.*?)】(.*)$/);
        if (tagMatch) {
            reasonHtml = `<div style="font-size:12px; line-height:1.5; color:#cbd5e1; text-align:left;">
                <span style="background:rgba(56, 189, 248, 0.15); color:#38bdf8; border:1px solid rgba(56, 189, 248, 0.35); padding:2px 7px; border-radius:4px; font-weight:600; display:inline-block; margin-bottom:4px;">
                    【${tagMatch[1]}】
                </span>
                <span style="display:block; color:#e2e8f0;">${tagMatch[2]}</span>
            </div>`;
        } else {
            reasonHtml = `<div style="font-size:12px; line-height:1.5; color:#e2e8f0; text-align:left;">${reasonText}</div>`;
        }

        html += `
        <tr>
            <td>${rankBadge}</td>
            <td><b style="color:#38bdf8">${s.stock_code}</b></td>
            <td>
                <a class="stock-link" onclick="openStockChartModal('${s.stock_code}', '${s.stock_name}')" style="font-weight:700; font-size:13px;">
                    ${s.stock_name}
                </a>
            </td>
            <td>${secLink}</td>
            <td><b style="color:#f8fafc">¥${s.current_price ? s.current_price.toFixed(2) : '--'}</b></td>
            <td><b style="color:${chgColor}">${sign}${s.change_percent ? s.change_percent.toFixed(2) : '0.00'}%</b></td>
            <td><span style="color:#e2e8f0">${s.turnover_rate ? s.turnover_rate.toFixed(2) + '%' : '--'}</span></td>
            <td><span style="color:#cbd5e1">${amtStr}</span></td>
            <td><span style="color:#94a3b8">${mktCapStr}</span></td>
            <td>
                <div style="display:flex; align-items:center; gap:6px;">
                    <div style="flex:1; height:6px; background:#334155; border-radius:3px; overflow:hidden; width:50px;">
                        <div style="width:${Math.min(100, s.heat_score)}%; height:100%; background:linear-gradient(90deg, #f59e0b, #ef4444); border-radius:3px;"></div>
                    </div>
                    <b style="color:#f59e0b; font-size:12px;">${s.heat_score}</b>
                </div>
            </td>
            <td style="min-width:320px; max-width:550px; white-space:normal; padding:8px 10px;">
                ${reasonHtml}
            </td>
            <td>${trendHtml}</td>
            <td>
                <button class="primary-btn" style="padding:2px 8px; font-size:11px;" onclick="openStockChartModal('${s.stock_code}', '${s.stock_name}')">
                    查看K线/分时
                </button>
            </td>
        </tr>`;
    });

    tbody.innerHTML = html;
    renderHotStocksPagination(totalPages);
}

function renderHotStocksPagination(totalPages) {
    const pContainer = document.getElementById("hot-stocks-pagination");
    const pTopContainer = document.getElementById("hot-stocks-pagination-top");
    if (!pContainer) return;

    const startIdx = (hotStocksCurrentPage - 1) * HOT_STOCKS_PAGE_SIZE + 1;
    const endIdx = Math.min(hotStocksCurrentPage * HOT_STOCKS_PAGE_SIZE, allHotStocksData.length);

    let infoHtml = `<span>第 <b style="color:#fff">${startIdx} - ${endIdx}</b> 条 / 共 <b style="color:#fff">${allHotStocksData.length}</b> 条 (每页 ${HOT_STOCKS_PAGE_SIZE} 条)</span>`;

    let btnsHtml = `
        <div style="display:flex; align-items:center; gap:5px;">
            <button class="chart-tab-btn" ${hotStocksCurrentPage <= 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} onclick="changeHotStocksPage(1)">首页</button>
            <button class="chart-tab-btn" ${hotStocksCurrentPage <= 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} onclick="changeHotStocksPage(${hotStocksCurrentPage - 1})">上一页</button>
    `;

    for (let p = 1; p <= totalPages; p++) {
        const activeClass = (p === hotStocksCurrentPage) ? 'active' : '';
        btnsHtml += `<button class="chart-tab-btn ${activeClass}" style="min-width:30px;" onclick="changeHotStocksPage(${p})">${p}</button>`;
    }

    btnsHtml += `
            <button class="chart-tab-btn" ${hotStocksCurrentPage >= totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} onclick="changeHotStocksPage(${hotStocksCurrentPage + 1})">下一页</button>
            <button class="chart-tab-btn" ${hotStocksCurrentPage >= totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} onclick="changeHotStocksPage(${totalPages})">末页</button>
        </div>
    `;

    pContainer.innerHTML = infoHtml + btnsHtml;
    if (pTopContainer) {
        pTopContainer.innerHTML = `
            <span style="font-size:12px; color:#94a3b8">页码 ${hotStocksCurrentPage}/${totalPages}</span>
            <button class="chart-tab-btn" style="padding:2px 8px; font-size:12px;" ${hotStocksCurrentPage <= 1 ? 'disabled style="opacity:0.5;"' : ''} onclick="changeHotStocksPage(${hotStocksCurrentPage - 1})">◀</button>
            <button class="chart-tab-btn" style="padding:2px 8px; font-size:12px;" ${hotStocksCurrentPage >= totalPages ? 'disabled style="opacity:0.5;"' : ''} onclick="changeHotStocksPage(${hotStocksCurrentPage + 1})">▶</button>
        `;
    }
}

function changeHotStocksPage(page) {
    renderHotStocksPage(page);
}

// 3. 加载每日 Top 20 板块详细数据、启动时间段与龙头梯队 (支持按成交总额、涨跌幅动态排序)
let sectorSortField = "rank_num";
let sectorSortAsc = true;

async function loadTop20Sectors() {
    try {
        const res = await fetch("/api/sectors/top20");
        const json = await res.json();
        if (json.status !== "success") return;

        sectorsData = json.data;
        renderTop20SectorsTable();
        renderSectorsChart(sectorsData);
    } catch (e) {
        console.error("加载Top20板块失败:", e);
    }
}

function sortTop20Sectors(field) {
    if (sectorSortField === field) {
        sectorSortAsc = !sectorSortAsc;
    } else {
        sectorSortField = field;
        sectorSortAsc = false; // 涨幅或成交额默认降序
    }
    
    // 更新表头箭头状态
    const iconChg = document.getElementById("sort-icon-change_percent");
    const iconAmt = document.getElementById("sort-icon-turnover_amount");
    if (iconChg) iconChg.innerText = (sectorSortField === 'change_percent') ? (sectorSortAsc ? '▲' : '▼') : '⇅';
    if (iconAmt) iconAmt.innerText = (sectorSortField === 'turnover_amount') ? (sectorSortAsc ? '▲' : '▼') : '⇅';

    sectorsData.sort((a, b) => {
        let valA = a[field] || 0;
        let valB = b[field] || 0;
        return sectorSortAsc ? (valA - valB) : (valB - valA);
    });

    renderTop20SectorsTable();
}

function renderTop20SectorsTable() {
    const tbody = document.getElementById("sectors-tbody");
    if (!tbody || !sectorsData) return;
    let html = "";

    sectorsData.forEach((sec, idx) => {
        const d1 = sec.dragons && sec.dragons.dragon_1 ? `<a class="stock-link" onclick="event.stopPropagation(); openStockChartModal('${sec.dragons.dragon_1.stock_code}', '${sec.dragons.dragon_1.stock_name}')">${sec.dragons.dragon_1.stock_name}</a> (+${sec.dragons.dragon_1.change_percent}%)` : "-";
        const d2 = sec.dragons && sec.dragons.dragon_2 ? `<a class="stock-link" onclick="event.stopPropagation(); openStockChartModal('${sec.dragons.dragon_2.stock_code}', '${sec.dragons.dragon_2.stock_name}')">${sec.dragons.dragon_2.stock_name}</a> (+${sec.dragons.dragon_2.change_percent}%)` : "-";
        const d3 = sec.dragons && sec.dragons.dragon_3 ? `<a class="stock-link" onclick="event.stopPropagation(); openStockChartModal('${sec.dragons.dragon_3.stock_code}', '${sec.dragons.dragon_3.stock_name}')">${sec.dragons.dragon_3.stock_name}</a> (+${sec.dragons.dragon_3.change_percent}%)` : "-";

        html += `
        <tr onclick="openSectorModal(${idx})" style="cursor:pointer">
            <td><span class="rank-index ${idx < 3 ? 'rank-top' + (idx+1) : ''}">${idx + 1}</span></td>
            <td><b style="color:#38bdf8">${sec.sector_name}</b> <span style="font-size:11px; color:#94a3b8">(${sec.constituents ? sec.constituents.length : 0}只)</span></td>
            <td><span class="tag tag-red">+${sec.change_percent.toFixed(2)}%</span></td>
            <td>${formatMoney(sec.turnover_amount)}</td>
            <td><span class="tag tag-period">${sec.launch_period}</span></td>
            <td><b style="color:#ef4444">${d1}</b></td>
            <td><span style="color:#f97316">${d2}</span></td>
            <td><span style="color:#eab308">${d3}</span></td>
            <td><span style="color:#cbd5e1; font-size:12px">${sec.launch_reason}</span></td>
        </tr>`;
    });

    tbody.innerHTML = html;
}

// 4. ECharts 渲染 Top 20 板块涨幅与成交量柱状图
function renderSectorsChart(data) {
    const chartDom = document.getElementById('sectors-chart');
    if (!chartDom) return;
    const myChart = echarts.init(chartDom, 'dark');

    const names = data.map(d => d.sector_name);
    const changes = data.map(d => d.change_percent);
    const amounts = data.map(d => (d.turnover_amount / 1e8).toFixed(1));

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' }
        },
        grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
        xAxis: {
            type: 'category',
            data: names,
            axisLabel: { interval: 0, rotate: 35, fontSize: 11 }
        },
        yAxis: [
            { type: 'value', name: '涨幅 (%)', axisLabel: { formatter: '{value} %' } },
            { type: 'value', name: '成交额 (亿)', splitLine: { show: false } }
        ],
        series: [
            {
                name: '板块涨跌幅',
                type: 'bar',
                data: changes,
                itemStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: '#ef4444' },
                        { offset: 1, color: '#b91c1c' }
                    ]),
                    borderRadius: [4, 4, 0, 0]
                }
            },
            {
                name: '板块成交额',
                type: 'line',
                yAxisIndex: 1,
                data: amounts,
                smooth: true,
                itemStyle: { color: '#f59e0b' }
            }
        ]
    };
    myChart.setOption(option);
    window.addEventListener('resize', () => myChart.resize());
}

// 5. 点击板块弹窗：支持按【现价、涨幅、换手率、成交额、总市值、市盈率(PE)、市净率(PB)】每一项进行升降序排序
let currentModalSectorIndex = null;
let currentModalStocks = [];
let modalSortField = "change_percent";
let modalSortAsc = false;

function openSectorModal(index) {
    currentModalSectorIndex = index;
    const sec = sectorsData[index];
    if (!sec) return;

    document.getElementById("modal-sector-title").innerHTML = `
        ${sec.sector_name} <span class="tag tag-red">+${sec.change_percent}%</span> 
        <span class="tag tag-period">启动时段: ${sec.launch_period}</span>
        <span style="font-size:13px; color:#94a3b8; margin-left:10px;">全部成分股共 ${sec.constituents ? sec.constituents.length : 0} 只</span>
    `;
    document.getElementById("modal-sector-desc").innerText = sec.launch_reason;

    currentModalStocks = (sec.constituents || []).slice();
    // 默认按涨幅降序
    modalSortField = "change_percent";
    modalSortAsc = false;
    updateModalSortIcons();
    renderModalStocksTable();

    document.getElementById("sector-modal").style.display = "flex";
}

async function openSectorByName(sectorName, sectorCode) {
    if (!sectorName || sectorName === '--' || sectorName === '综合行业') {
        alert("暂无该个股的详细板块归属数据");
        return;
    }

    // 1. 如果在 sectorsData 中存在该板块，直接复用 openSectorModal
    if (sectorsData && sectorsData.length > 0) {
        const foundIdx = sectorsData.findIndex(s => s.sector_name === sectorName || (sectorCode && s.sector_code === sectorCode));
        if (foundIdx >= 0) {
            openSectorModal(foundIdx);
            return;
        }
    }

    // 2. 否则通过 /api/sector/detail 接口动态获取该板块的全量成分股数据
    const modal = document.getElementById("sector-modal");
    modal.style.display = "flex";
    
    document.getElementById("modal-sector-title").innerHTML = `
        ${sectorName} <span style="font-size:13px; color:#38bdf8; margin-left:10px;">正在穿透获取该板块全部股票与详细指标...</span>
    `;
    document.getElementById("modal-sector-desc").innerText = "全市场行业板块明细穿透查询中...";
    document.getElementById("modal-stocks-tbody").innerHTML = `
        <tr><td colspan="11" style="text-align:center; padding:30px; color:#94a3b8">
            <div class="loader" style="margin: 0 auto 10px;"></div>
            正在实时穿透提取【${sectorName}】板块内所有股票、现价、涨跌幅、换手率与估值指标...
        </td></tr>
    `;

    try {
        const res = await fetch(`/api/sector/detail?name=${encodeURIComponent(sectorName)}&code=${encodeURIComponent(sectorCode || '')}`);
        const json = await res.json();
        if (json.status === "success" && json.data) {
            const sec = json.data;
            const chgSign = (sec.change_percent >= 0) ? '+' : '';
            const chgColor = (sec.change_percent >= 0) ? 'tag-red' : 'tag-green';
            
            document.getElementById("modal-sector-title").innerHTML = `
                ${sec.sector_name} <span class="tag ${chgColor}">${chgSign}${sec.change_percent ? sec.change_percent.toFixed(2) : '0.00'}%</span> 
                <span class="tag tag-period">启动时段: ${sec.launch_period || '盘中全天'}</span>
                <span style="font-size:13px; color:#94a3b8; margin-left:10px;">全部成分股共 ${sec.constituents ? sec.constituents.length : 0} 只</span>
            `;
            document.getElementById("modal-sector-desc").innerText = sec.launch_reason || '行业板块全量成分股行情透视与多因子指标明细';

            currentModalStocks = (sec.constituents || []).slice();
            modalSortField = "change_percent";
            modalSortAsc = false;
            updateModalSortIcons();
            renderModalStocksTable();
        } else {
            document.getElementById("modal-sector-desc").innerText = "未能加载该板块成分股数据";
            document.getElementById("modal-stocks-tbody").innerHTML = `
                <tr><td colspan="11" style="text-align:center; padding:30px; color:#94a3b8">未能获取到【${sectorName}】板块的成分股数据</td></tr>
            `;
        }
    } catch (e) {
        console.error("加载板块详情失败:", e);
        document.getElementById("modal-stocks-tbody").innerHTML = `
            <tr><td colspan="11" style="text-align:center; padding:30px; color:#ef4444">加载失败: ${e.message}</td></tr>
        `;
    }
}

function sortModalStocks(field) {
    if (modalSortField === field) {
        modalSortAsc = !modalSortAsc;
    } else {
        modalSortField = field;
        modalSortAsc = (field === 'price' || field === 'pe_ratio' || field === 'pb_ratio') ? true : false;
    }

    updateModalSortIcons();

    currentModalStocks.sort((a, b) => {
        let valA = a[field] != null ? Number(a[field]) : -999999;
        let valB = b[field] != null ? Number(b[field]) : -999999;
        if (isNaN(valA)) valA = -999999;
        if (isNaN(valB)) valB = -999999;
        return modalSortAsc ? (valA - valB) : (valB - valA);
    });

    renderModalStocksTable();
}

function updateModalSortIcons() {
    const fields = ['price', 'change_percent', 'turnover_rate', 'amount', 'mkt_cap', 'pe_ratio', 'pb_ratio'];
    fields.forEach(f => {
        const icon = document.getElementById("sort-modal-" + f);
        if (icon) {
            icon.innerText = (modalSortField === f) ? (modalSortAsc ? '▲' : '▼') : '⇅';
        }
    });
}

function renderModalStocksTable() {
    const tbody = document.getElementById("modal-stocks-tbody");
    if (!tbody) return;
    let html = "";
    currentModalStocks.forEach((st) => {
        let tagHtml = "-";
        if (st.is_dragon_rank === 1) tagHtml = `<span class="tag tag-red">👑 龙1 先锋</span>`;
        else if (st.is_dragon_rank === 2) tagHtml = `<span class="tag tag-gold">⭐ 龙2 中军</span>`;
        else if (st.is_dragon_rank === 3) tagHtml = `<span class="tag tag-blue">⚡ 龙3 助攻</span>`;
        else if (st.change_percent <= 0) tagHtml = `<span class="tag tag-green">后排 调整</span>`;
        else if (st.change_percent <= 2.0) tagHtml = `<span class="tag tag-period">后排 跟风</span>`;
        else tagHtml = `<span class="tag" style="background:#1e293b; color:#cbd5e1">中梯队</span>`;

        html += `
        <tr>
            <td><a class="stock-link" onclick="openStockChartModal('${st.stock_code}', '${st.stock_name}')">${st.stock_code}</a></td>
            <td><a class="stock-link" onclick="openStockChartModal('${st.stock_code}', '${st.stock_name}')"><b>${st.stock_name}</b></a></td>
            <td>¥${st.price ? st.price.toFixed(2) : '--'}</td>
            <td style="color:${st.change_percent >= 0 ? '#ef4444' : '#10b981'}; font-weight:700">
                ${st.change_percent >= 0 ? '+' : ''}${st.change_percent ? st.change_percent.toFixed(2) : '0.00'}%
            </td>
            <td>${st.turnover_rate ? st.turnover_rate.toFixed(2) + '%' : '--'}</td>
            <td>${formatMoney(st.amount)}</td>
            <td>${st.mkt_cap ? st.mkt_cap.toFixed(1) + ' 亿' : '--'}</td>
            <td>${st.pe_ratio > 0 ? st.pe_ratio.toFixed(1) : '-'}</td>
            <td>${st.pb_ratio > 0 ? st.pb_ratio.toFixed(2) : '-'}</td>
            <td>${tagHtml}</td>
            <td style="font-size:12px; color:#cbd5e1">${st.dragon_reason || '-'}</td>
        </tr>`;
    });
    tbody.innerHTML = html;
}

function closeSectorModal() {
    document.getElementById("sector-modal").style.display = "none";
}

// 6. 股票深度图表弹窗 (即时分时图 + 多周期K线: 日K / 周K / 月K / 年K + 备注: 人气与热度归因)
let cachedStockChartData = null;
let currentStockChartName = "";

async function openStockChartModal(stockCode, stockName) {
    currentStockChartCode = stockCode;
    currentStockChartName = stockName;
    const modal = document.getElementById("stock-chart-modal");
    modal.style.display = "flex";

    // 默认展示即时分时，重置容器显示状态
    const chartDom = document.getElementById("single-stock-chart");
    const reasonDom = document.getElementById("stock-reason-container");
    if (chartDom) chartDom.style.display = "block";
    if (reasonDom) reasonDom.style.display = "none";

    currentStockChartType = "minute";
    updateStockChartTabUI("minute");

    document.getElementById("chart-stock-info").innerHTML = `
        <span style="font-size:20px; font-weight:700; color:#fff">${stockName} (${stockCode})</span>
        <span style="font-size:14px; color:#94a3b8">正在载入实时行情与分时/K线图...</span>
    `;

    try {
        const res = await fetch(`/api/stock/chart_data?code=${stockCode}&period=day`);
        const json = await res.json();
        if (json.status !== "success") return;

        cachedStockChartData = json;
        const q = json.quote || {};
        const isUp = q.change_percent >= 0;

        document.getElementById("chart-stock-info").innerHTML = `
            <div style="font-size:22px; font-weight:700; color:#fff">${stockName} (${stockCode})</div>
            <div style="display:flex; align-items:baseline; gap:12px; flex-wrap:wrap;">
                <span style="font-size:24px; font-weight:700; color:${isUp ? '#ef4444' : '#10b981'}">¥${(q.current_price || 0).toFixed(2)}</span>
                <span class="tag ${isUp ? 'tag-red' : 'tag-green'}">${isUp ? '+' : ''}${(q.change_percent || 0).toFixed(2)}%</span>
                <span style="font-size:13px; color:#94a3b8">换手率: <b style="color:#e2e8f0">${q.turnover_rate || 0}%</b></span>
                <span style="font-size:13px; color:#94a3b8">成交额: <b style="color:#e2e8f0">${formatMoney((q.amount || 0) * 10000)}</b></span>
                <span style="font-size:13px; color:#94a3b8">最高: <b style="color:#ef4444">${q.high_price || 0}</b> | 最低: <b style="color:#10b981">${q.low_price || 0}</b></span>
                <button class="primary-btn" onclick="switchStockChartTab('reason')" style="background:#312e81; border:1px solid #6366f1; color:#c7d2fe; padding:2px 10px; font-size:11px; margin-left:6px; cursor:pointer;">
                    🔥 查看高人气/热度归因
                </button>
            </div>
        `;

        renderStockChart();
    } catch (e) {
        console.error("加载股票K线分时异常:", e);
    }
}

function closeStockChartModal() {
    document.getElementById("stock-chart-modal").style.display = "none";
}

function updateStockChartTabUI(type) {
    const tabIds = ["minute", "day", "week", "month", "year", "reason"];
    tabIds.forEach(t => {
        const btn = document.getElementById("tab-chart-" + t);
        if (btn) {
            btn.className = (t === type) ? "chart-tab-btn active" : "chart-tab-btn";
        }
    });
}

async function switchStockChartTab(type) {
    currentStockChartType = type;
    updateStockChartTabUI(type);

    const chartDom = document.getElementById("single-stock-chart");
    const reasonDom = document.getElementById("stock-reason-container");

    if (type === "reason") {
        if (chartDom) chartDom.style.display = "none";
        if (reasonDom) reasonDom.style.display = "block";
        loadStockPopularityReason(currentStockChartCode, currentStockChartName);
        return;
    }

    if (chartDom) chartDom.style.display = "block";
    if (reasonDom) reasonDom.style.display = "none";

    if (type === "minute") {
        renderStockChart();
        return;
    }

    // 若切换到特定K线周期 (day, week, month, year)，动态按周期拉取该周期的K线
    try {
        const res = await fetch(`/api/stock/chart_data?code=${currentStockChartCode}&period=${type}`);
        const json = await res.json();
        if (json.status === "success") {
            cachedStockChartData.kline = json.kline;
            cachedStockChartData.period = json.period;
            renderStockChart();
        }
    } catch (e) {
        console.error(`切换至 ${type} K线失败:`, e);
    }
}

async function loadStockPopularityReason(stockCode, stockName) {
    const container = document.getElementById("stock-reason-container");
    if (!container) return;

    container.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:60px 0; gap:12px;">
            <div class="loading-spinner"></div>
            <div style="color:#94a3b8; font-size:14px;">正在多维穿透采集 ${stockName || stockCode} 的实时人气排位、核心题材入选理由、龙虎榜席位与最新事件...</div>
        </div>
    `;

    try {
        const res = await fetch(`/api/stock/popularity_reason?code=${stockCode}&name=${encodeURIComponent(stockName || '')}`);
        const json = await res.json();
        if (json.status !== "success" || !json.data) {
            container.innerHTML = `<div style="color:#f87171; padding:30px; text-align:center;">获取人气热度归因数据失败: ${json.message || '未知错误'}</div>`;
            return;
        }

        renderStockPopularityReasonView(json.data);
    } catch (e) {
        console.error("加载股票归因异常:", e);
        container.innerHTML = `<div style="color:#f87171; padding:30px; text-align:center;">加载股票归因异常: ${e.message}</div>`;
    }
}

function renderStockPopularityReasonView(d) {
    const container = document.getElementById("stock-reason-container");
    if (!container) return;

    const q = d.quote || {};
    const rank = d.popularity_rank || {};
    const themes = d.themes || [];
    const dragonTiger = d.dragon_tiger || [];
    const news = d.news || [];
    const synthesis = d.synthesis || [];
    const isUp = (q.change_percent || 0) >= 0;

    // 人气徽章
    let rankBadge = "";
    if (rank.current_rank) {
        rankBadge = `
            <div style="background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); color:#fff; font-weight:800; padding:6px 14px; border-radius:20px; font-size:13px; display:inline-flex; align-items:center; gap:6px; box-shadow:0 4px 12px rgba(245, 158, 11, 0.35);">
                <span>🔥 东方财富全市场人气榜</span>
                <span style="font-size:16px; background:rgba(0,0,0,0.25); padding:2px 8px; border-radius:12px;">第 ${rank.current_rank} 名</span>
            </div>
        `;
    } else {
        rankBadge = `
            <div style="background:#1e293b; color:#94a3b8; font-weight:600; padding:6px 14px; border-radius:20px; font-size:12px; display:inline-flex; align-items:center; gap:6px;">
                <span>📊 全市场关注度追踪中</span>
            </div>
        `;
    }

    // 角色标签
    const tagsHtml = (d.role_tags || []).map(t => `<span class="tag tag-gold" style="font-size:12px; padding:3px 8px;">${t}</span>`).join(' ');

    // 核心综合诊断小结
    let synthesisCardsHtml = "";
    if (synthesis.length > 0) {
        synthesisCardsHtml = `
            <div style="background:#0f172a; border:1px solid #1e293b; border-left:4px solid #6366f1; border-radius:10px; padding:16px 20px;">
                <div style="font-size:15px; font-weight:700; color:#c7d2fe; margin-bottom:12px; display:flex; align-items:center; gap:8px;">
                    <span>💡 投研综合归因诊断：为什么该股当前具备极高人气与热度？</span>
                </div>
                <div style="display:flex; flex-direction:column; gap:10px;">
                    ${synthesis.map(s => `
                        <div style="background:#1e293b; border-radius:8px; padding:10px 14px;">
                            <div style="font-size:13px; font-weight:700; color:#38bdf8; margin-bottom:4px;">${s.dimension} · ${s.title}</div>
                            <div style="font-size:12.5px; color:#cbd5e1; line-height:1.6;">${s.detail}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // 题材风口与入选理由
    let themesHtml = "";
    if (themes.length > 0) {
        themesHtml = `
            <div style="background:#101728; border:1px solid #233152; border-radius:10px; padding:16px 20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
                    <div style="font-size:14px; font-weight:700; color:#f8fafc; display:flex; align-items:center; gap:8px;">
                        <span>🎯 关联核心题材风口与入选理由 (${themes.length} 个)</span>
                    </div>
                    <span style="font-size:11px; color:#94a3b8">优先展示官方认证入选驱动原因</span>
                </div>
                <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(310px, 1fr)); gap:12px;">
                    ${themes.slice(0, 8).map(t => `
                        <div style="background:#182238; border:1px solid #2d3d63; border-radius:8px; padding:12px; display:flex; flex-direction:column; gap:6px;">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="font-weight:700; color:#38bdf8; font-size:13px;">${t.board_name}</span>
                                <span class="tag tag-blue" style="font-size:10px;">核心概念</span>
                            </div>
                            <div style="font-size:12px; color:#94a3b8; line-height:1.5;">
                                ${t.reason ? `<b style="color:#cbd5e1;">【入选原因】</b>${t.reason}` : '<span style="color:#64748b;">市场常规热门板块覆盖，联动跟踪中</span>'}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // 龙虎榜席位明细
    let dtHtml = "";
    if (dragonTiger.length > 0) {
        dtHtml = `
            <div style="background:#101728; border:1px solid #233152; border-radius:10px; padding:16px 20px;">
                <div style="font-size:14px; font-weight:700; color:#f8fafc; margin-bottom:12px; display:flex; align-items:center; gap:8px;">
                    <span>💰 近期龙虎榜席位异动明细</span>
                </div>
                <div class="table-responsive">
                    <table>
                        <thead>
                            <tr>
                                <th>交易日期</th>
                                <th>异动上榜原因</th>
                                <th>收盘价</th>
                                <th>涨跌幅</th>
                                <th>龙虎榜净买额</th>
                                <th>买入总额</th>
                                <th>卖出总额</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${dragonTiger.map(dt => {
                                const isNetBuy = dt.net_amount >= 0;
                                return `
                                    <tr>
                                        <td><b style="color:#e2e8f0">${dt.trade_date}</b></td>
                                        <td style="max-width:240px; white-space:normal; font-size:12px; color:#cbd5e1">${dt.explanation}</td>
                                        <td>¥${dt.close_price.toFixed(2)}</td>
                                        <td style="color:${dt.change_rate >= 0 ? '#ef4444' : '#10b981'}; font-weight:700">${dt.change_rate >= 0 ? '+' : ''}${dt.change_rate.toFixed(2)}%</td>
                                        <td style="color:${isNetBuy ? '#ef4444' : '#10b981'}; font-weight:800">${isNetBuy ? '+' : ''}${dt.net_amount} 万元</td>
                                        <td>${dt.buy_amount} 万元</td>
                                        <td>${dt.sell_amount} 万元</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // 最新资讯事件
    let newsHtml = "";
    if (news.length > 0) {
        newsHtml = `
            <div style="background:#101728; border:1px solid #233152; border-radius:10px; padding:16px 20px;">
                <div style="font-size:14px; font-weight:700; color:#f8fafc; margin-bottom:12px; display:flex; align-items:center; gap:8px;">
                    <span>📰 最新异动事件与重磅舆情快讯</span>
                </div>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    ${news.map(n => `
                        <div style="background:#182238; border-radius:6px; padding:10px 14px; display:flex; flex-direction:column; gap:4px;">
                            <div style="display:flex; justify-content:space-between; align-items:baseline;">
                                <span style="font-size:13px; font-weight:700; color:#f1f5f9;">${n.title}</span>
                                <span style="font-size:11px; color:#64748b;">${n.date || ''}</span>
                            </div>
                            <div style="font-size:12px; color:#94a3b8; line-height:1.4;">${n.summary}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // 用户专属自选操盘备注
    const savedNote = d.user_note || localStorage.getItem(`stock_note_${d.stock_code}`) || "";
    const noteUpdatedAt = d.user_note_updated_at ? `最后更新于: ${d.user_note_updated_at}` : "";

    const userNoteHtml = `
        <div style="background:#111c33; border:1px solid #3b82f6; border-radius:10px; padding:18px 20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <div style="font-size:14px; font-weight:700; color:#93c5fd; display:flex; align-items:center; gap:8px;">
                    <span>✏️ 我的操盘备注与投资笔记 (持久化保存)</span>
                </div>
                <span id="note-save-status" style="font-size:12px; color:#94a3b8;">${noteUpdatedAt}</span>
            </div>
            <textarea id="stock-user-note-input" rows="3" placeholder="在此记录您对 ${d.stock_name} (${d.stock_code}) 的选股逻辑、买卖计划、支撑/压力位、自选跟踪要点..." style="width:100%; box-sizing:border-box; background:#0b1120; border:1px solid #334155; border-radius:8px; padding:10px 12px; color:#f8fafc; font-size:13px; line-height:1.5; resize:vertical; outline:none; font-family:inherit;">${savedNote}</textarea>
            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:10px;">
                <button class="primary-btn" onclick="saveUserStockNote('${d.stock_code}', '${d.stock_name}')" style="display:inline-flex; align-items:center; gap:6px; background:#2563eb; padding:6px 18px; cursor:pointer;">
                    💾 保存备注
                </button>
            </div>
        </div>
    `;

    // 组装整体面板
    container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:14px;">
            <!-- 顶部热度与角色卡片 -->
            <div style="background: linear-gradient(135deg, #131c31 0%, #17223b 100%); border:1px solid #233152; border-radius:12px; padding:16px 20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                <div style="display:flex; align-items:center; gap:14px; flex-wrap:wrap;">
                    ${rankBadge}
                    <div style="display:flex; gap:6px; flex-wrap:wrap;">
                        ${tagsHtml}
                    </div>
                </div>
                <div style="display:flex; gap:18px; align-items:center; flex-wrap:wrap;">
                    <div style="text-align:right;">
                        <div style="font-size:11px; color:#94a3b8;">今日现价</div>
                        <div style="font-size:18px; font-weight:800; color:${isUp ? '#ef4444' : '#10b981'};">¥${(q.current_price || 0).toFixed(2)}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:11px; color:#94a3b8;">涨跌幅</div>
                        <div style="font-size:18px; font-weight:800; color:${isUp ? '#ef4444' : '#10b981'};">${isUp ? '+' : ''}${(q.change_percent || 0).toFixed(2)}%</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:11px; color:#94a3b8;">换手率</div>
                        <div style="font-size:16px; font-weight:700; color:#f8fafc;">${q.turnover_rate || 0}%</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:11px; color:#94a3b8;">成交额</div>
                        <div style="font-size:16px; font-weight:700; color:#f8fafc;">${formatMoney((q.amount || 0) * 10000)}</div>
                    </div>
                </div>
            </div>

            <!-- 投研归因诊断 -->
            ${synthesisCardsHtml}

            <!-- 题材风口与入选理由 -->
            ${themesHtml}

            <!-- 龙虎榜席位明细 -->
            ${dtHtml}

            <!-- 最新资讯与异动 -->
            ${newsHtml}

            <!-- 用户操盘备注笔记 -->
            ${userNoteHtml}
        </div>
    `;
}

async function saveUserStockNote(stockCode, stockName) {
    const textarea = document.getElementById("stock-user-note-input");
    const statusLabel = document.getElementById("note-save-status");
    if (!textarea) return;

    const note = textarea.value.trim();
    localStorage.setItem(`stock_note_${stockCode}`, note);

    if (statusLabel) {
        statusLabel.style.color = "#38bdf8";
        statusLabel.innerText = "正在保存到数据库...";
    }

    try {
        const res = await fetch("/api/stock/note", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: stockCode, name: stockName, note: note })
        });
        const json = await res.json();
        if (json.status === "success") {
            if (statusLabel) {
                statusLabel.style.color = "#10b981";
                statusLabel.innerText = "✔ 备注已成功保存！";
                setTimeout(() => {
                    statusLabel.innerText = `最后更新: ${new Date().toLocaleTimeString()}`;
                    statusLabel.style.color = "#94a3b8";
                }, 3000);
            }
        }
    } catch (e) {
        console.error("保存备注网络异常:", e);
        if (statusLabel) {
            statusLabel.style.color = "#f59e0b";
            statusLabel.innerText = "✔ 本地已备份 (离线保存)";
        }
    }
}

function renderStockChart() {
    if (!cachedStockChartData) return;
    const chartDom = document.getElementById('single-stock-chart');
    if (!chartDom) return;

    if (!singleStockChartInstance) {
        singleStockChartInstance = echarts.init(chartDom, 'dark');
        window.addEventListener('resize', () => singleStockChartInstance.resize());
    }

    if (currentStockChartType === "minute") {
        // 渲染即时分时图
        const minutes = cachedStockChartData.minute || [];
        const times = minutes.map(m => m.time);
        const prices = minutes.map(m => m.price);
        const volumes = minutes.map(m => m.volume);
        const yesterdayClose = cachedStockChartData.quote ? cachedStockChartData.quote.yesterday_close : (prices[0] || 0);

        const option = {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'cross' }
            },
            grid: [
                { left: '4%', right: '4%', top: '8%', height: '60%' },
                { left: '4%', right: '4%', top: '75%', height: '18%' }
            ],
            xAxis: [
                { type: 'category', data: times, gridIndex: 0, axisLabel: { interval: 29 } },
                { type: 'category', data: times, gridIndex: 1, axisLabel: { show: false } }
            ],
            yAxis: [
                {
                    type: 'value',
                    gridIndex: 0,
                    scale: true,
                    splitLine: { lineStyle: { color: '#233152' } }
                },
                {
                    type: 'value',
                    gridIndex: 1,
                    scale: true,
                    splitLine: { show: false }
                }
            ],
            series: [
                {
                    name: '分时价格',
                    type: 'line',
                    data: prices,
                    gridIndex: 0,
                    smooth: true,
                    showSymbol: false,
                    lineStyle: { width: 2, color: '#38bdf8' },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(56, 189, 248, 0.4)' },
                            { offset: 1, color: 'rgba(56, 189, 248, 0.02)' }
                        ])
                    },
                    markLine: yesterdayClose ? {
                        silent: true,
                        symbol: 'none',
                        data: [{ yAxis: yesterdayClose, lineStyle: { color: '#94a3b8', type: 'dashed' } }]
                    } : undefined
                },
                {
                    name: '分时成交量',
                    type: 'bar',
                    data: volumes,
                    xAxisIndex: 1,
                    yAxisIndex: 1,
                    itemStyle: { color: '#f59e0b' }
                }
            ]
        };
        singleStockChartInstance.setOption(option, true);
    } else {
        // 渲染多周期K线图 (日K / 周K / 月K / 年K)
        const periodNameMap = { day: "日K线", week: "周K线", month: "月K线", year: "年K线" };
        const pTitle = periodNameMap[currentStockChartType] || "K线";

        const klines = cachedStockChartData.kline || [];
        const dates = klines.map(k => k.date);
        // ECharts K线数据格式: [open, close, lowest, highest]
        const candleValues = klines.map(k => [k.open, k.close, k.low, k.high]);
        const vols = klines.map(k => k.volume);

        const option = {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'cross' }
            },
            grid: [
                { left: '4%', right: '4%', top: '8%', height: '62%' },
                { left: '4%', right: '4%', top: '76%', height: '18%' }
            ],
            xAxis: [
                { type: 'category', data: dates, gridIndex: 0, scale: true },
                { type: 'category', data: dates, gridIndex: 1, scale: true, axisLabel: { show: false } }
            ],
            yAxis: [
                {
                    scale: true,
                    gridIndex: 0,
                    splitLine: { lineStyle: { color: '#233152' } }
                },
                {
                    scale: true,
                    gridIndex: 1,
                    splitLine: { show: false }
                }
            ],
            dataZoom: [
                { type: 'inside', xAxisIndex: [0, 1], start: dates.length > 30 ? 30 : 0, end: 100 },
                { type: 'slider', xAxisIndex: [0, 1], top: '96%', height: 16 }
            ],
            series: [
                {
                    name: `${pTitle} (前复权)`,
                    type: 'candlestick',
                    data: candleValues,
                    gridIndex: 0,
                    itemStyle: {
                        color: '#ef4444',
                        color0: '#10b981',
                        borderColor: '#ef4444',
                        borderColor0: '#10b981'
                    }
                },
                {
                    name: '成交量',
                    type: 'bar',
                    data: vols,
                    xAxisIndex: 1,
                    yAxisIndex: 1,
                    itemStyle: {
                        color: (params) => {
                            const val = candleValues[params.dataIndex];
                            return val && val[1] >= val[0] ? '#ef4444' : '#10b981';
                        }
                    }
                }
            ]
        };
        singleStockChartInstance.setOption(option, true);
    }
}

// 7. 板块历史 PB / PE 综合对比中心逻辑 (支持全市场 880+ 板块首字母/缩写/全拼/汉字联想搜索)
let activeSuggestedSectors = [];

async function loadAllSectorsDropdown() {
    try {
        const res = await fetch("/api/sectors/all");
        const json = await res.json();
        if (json.status !== "success") return;

        allSectorsList = json.data;

        // 填充下拉菜单 (按类别分组展示全市场板块)
        const select = document.getElementById("sector-select-dropdown");
        if (select) {
            let html = `<option value="">-- 全市场板块下拉列表 (${allSectorsList.length}) --</option>`;
            
            // 按类别聚合
            const catMap = {};
            allSectorsList.forEach(s => {
                const cat = s.category || "其他板块";
                if (!catMap[cat]) catMap[cat] = [];
                catMap[cat].push(s);
            });

            for (const cat in catMap) {
                html += `<optgroup label="【${cat}】">`;
                catMap[cat].forEach(s => {
                    const chg = s.change_percent !== undefined ? ` (${s.change_percent >= 0 ? '+' : ''}${s.change_percent}%)` : '';
                    const init = s.pinyin_initials ? ` [${s.pinyin_initials}]` : '';
                    html += `<option value="${s.sector_code}">${s.sector_name}${init}${chg}</option>`;
                });
                html += `</optgroup>`;
            }
            select.innerHTML = html;
        }

        updateChosenSectorsTagsUI();
    } catch (e) {
        console.error("加载所有板块列表失败:", e);
    }
}

// 下拉菜单选择回调
function onSelectDropdownChanged(sectorCode) {
    if (!sectorCode) return;
    const sec = allSectorsList.find(s => s.sector_code === sectorCode);
    const name = sec ? sec.sector_name : sectorCode;
    selectSearchedSector(sectorCode, name);
    // 重置下拉菜单选中的占位项
    const select = document.getElementById("sector-select-dropdown");
    if (select) select.value = "";
}

// 联想搜索板块: 支持拼音缩写 (SWZZ / CBZZ)、全拼 (shengwuzhizao)、汉字 (生物制造) 或代码 (new_swzz)
function onSectorSearchInput(keyword) {
    const box = document.getElementById("sector-search-suggestions");
    if (!box) return;

    const kw = (keyword || "").trim().toUpperCase();
    if (!kw) {
        box.style.display = "none";
        box.innerHTML = "";
        activeSuggestedSectors = [];
        return;
    }

    // 匹配: 汉字包含, 首字母缩写包含, 全拼包含, 或代码包含
    activeSuggestedSectors = allSectorsList.filter(s => {
        const nameUpper = (s.sector_name || "").toUpperCase();
        const codeUpper = (s.sector_code || "").toUpperCase();
        const initials = (s.pinyin_initials || "").toUpperCase();
        const fullPinyin = (s.pinyin_full || "").toUpperCase();
        return nameUpper.includes(kw) ||
               initials.includes(kw) ||
               fullPinyin.includes(kw) ||
               codeUpper.includes(kw);
    }).slice(0, 15); // 最多展示前 15 项联想

    if (activeSuggestedSectors.length === 0) {
        box.innerHTML = `<div style="padding:10px; color:#94a3b8; font-size:12px; text-align:center;">未找到匹配板块 "${kw}"</div>`;
        box.style.display = "block";
        return;
    }

    let html = "";
    activeSuggestedSectors.forEach((sec, idx) => {
        const isChosen = chosenSectorsForValuation.includes(sec.sector_code);
        html += `
        <div class="suggestion-item" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; justify-content: space-between; align-items: center; ${isChosen ? 'opacity: 0.5;' : ''}"
             onmouseover="this.style.background='rgba(59, 130, 246, 0.25)'" 
             onmouseout="this.style.background='transparent'"
             onclick="selectSearchedSector('${sec.sector_code}', '${sec.sector_name}')">
            <div>
                <b style="color: #38bdf8">${sec.sector_name}</b>
                <span style="font-size: 11px; color: #94a3b8; margin-left: 6px;">[${sec.pinyin_initials || ''}]</span>
            </div>
            <div style="font-size: 11px; color: ${sec.change_percent >= 0 ? '#ef4444' : '#10b981'}">
                ${isChosen ? '<span class="tag tag-gold" style="font-size:10px">已添加</span>' : (sec.change_percent >= 0 ? '+' : '') + (sec.change_percent || 0) + '%'}
            </div>
        </div>`;
    });

    box.innerHTML = html;
    box.style.display = "block";
}

let currentValuationDataMap = null;
let currentValuationAllDates = [];

function selectSearchedSector(code, name) {
    const input = document.getElementById("sector-search-input");
    const box = document.getElementById("sector-search-suggestions");
    if (box) {
        box.style.display = "none";
        box.innerHTML = "";
    }
    activeSuggestedSectors = [];
    if (input) input.value = "";

    if (!code) return;
    if (chosenSectorsForValuation.includes(code)) {
        return;
    }
    chosenSectorsForValuation.push(code);
    updateChosenSectorsTagsUI();
    renderValuationComparison();
}

async function addSearchedSector() {
    const input = document.getElementById("sector-search-input");
    const val = input ? input.value.trim() : "";

    // 确保板块列表已就绪
    if (!allSectorsList || allSectorsList.length === 0) {
        try {
            await loadAllSectorsDropdown();
        } catch(e) {}
    }
    
    // 如果下拉联想里有匹配结果且用户直接回车或点击添加，取第一个
    if (activeSuggestedSectors.length > 0) {
        selectSearchedSector(activeSuggestedSectors[0].sector_code, activeSuggestedSectors[0].sector_name);
        return;
    }

    if (!val) {
        alert("请输入板块名称或拼音首字母 (例如: SWZZ, CBZZ, 船舶制造)！");
        return;
    }

    // 精确或包含查找
    const upper = val.toUpperCase();
    let found = allSectorsList.find(s => 
        (s.sector_name && s.sector_name.toUpperCase() === upper) ||
        (s.pinyin_initials && s.pinyin_initials.toUpperCase() === upper) ||
        (s.sector_code && s.sector_code.toUpperCase() === upper)
    );

    if (!found) {
        found = allSectorsList.find(s => 
            (s.sector_name && s.sector_name.toUpperCase().includes(upper)) ||
            (s.pinyin_initials && s.pinyin_initials.toUpperCase().includes(upper)) ||
            (s.pinyin_full && s.pinyin_full.toUpperCase().includes(upper)) ||
            (s.sector_code && s.sector_code.toUpperCase().includes(upper))
        );
    }

    if (found) {
        selectSearchedSector(found.sector_code, found.sector_name);
    } else {
        alert(`未找到匹配板块 "${val}"，请检查输入或在下拉列表中选择！`);
    }
}

// 点击空白处关闭联想框
document.addEventListener("click", (e) => {
    const searchContainer = document.querySelector(".sector-select-box");
    const box = document.getElementById("sector-search-suggestions");
    if (box && searchContainer && !searchContainer.contains(e.target)) {
        box.style.display = "none";
    }
});

function updateChosenSectorsTagsUI() {
    const container = document.getElementById("chosen-sectors-tags");
    if (!container) return;

    if (!chosenSectorsForValuation || chosenSectorsForValuation.length === 0) {
        container.innerHTML = `<span style="font-size:12px; color:#94a3b8">已添加板块:</span> <span style="font-size:12px; color:#64748b">暂无（请在上方选择或输入添加板块）</span>`;
        return;
    }

    let html = `<span style="font-size:12px; color:#94a3b8">已添加板块:</span>`;
    chosenSectorsForValuation.forEach(code => {
        const sec = allSectorsList.find(s => s.sector_code === code);
        const name = sec ? sec.sector_name : code;
        html += `
        <span class="chosen-sector-tag">
            ${name}
            <span class="remove-tag" onclick="removeSectorFromComparison('${code}')">✕</span>
        </span>`;
    });
    container.innerHTML = html;
}

function removeSectorFromComparison(code) {
    chosenSectorsForValuation = chosenSectorsForValuation.filter(c => c !== code);
    updateChosenSectorsTagsUI();
    renderValuationComparison();
}

function clearAllComparedSectors() {
    chosenSectorsForValuation = [];
    updateChosenSectorsTagsUI();
    renderValuationComparison();
}

function switchValuationPeriod(period) {
    currentValuationPeriod = period;
    const periods = ["day", "week", "month", "year"];
    periods.forEach(p => {
        const btn = document.getElementById("val-period-" + p);
        if (btn) {
            btn.className = (p === period) ? "chart-tab-btn active" : "chart-tab-btn";
        }
    });
    renderValuationComparison();
}

function switchValuationMetric(metric) {
    currentValuationMetric = metric;
    document.getElementById("val-metric-pe").className = metric === "pe" ? "chart-tab-btn active" : "chart-tab-btn";
    document.getElementById("val-metric-pb").className = metric === "pb" ? "chart-tab-btn active" : "chart-tab-btn";
    renderValuationComparison();
}

// 获取当前横轴可见区间信息（起止日期、年份区间如 "2024年至2026年"）
function getVisibleValuationDateRange(explicitStart, explicitEnd) {
    if (!currentValuationAllDates || currentValuationAllDates.length === 0) {
        return {
            startIndex: 0,
            endIndex: 0,
            startDate: '',
            endDate: '',
            yearRangeText: '历史区间'
        };
    }
    let startIndex = 0;
    let endIndex = currentValuationAllDates.length - 1;

    if (explicitStart !== undefined && explicitEnd !== undefined) {
        startIndex = Math.max(0, Math.min(currentValuationAllDates.length - 1, Math.floor((explicitStart / 100) * (currentValuationAllDates.length - 1))));
        endIndex = Math.max(startIndex, Math.min(currentValuationAllDates.length - 1, Math.ceil((explicitEnd / 100) * (currentValuationAllDates.length - 1))));
    } else if (valuationChartInstance) {
        const opt = valuationChartInstance.getOption();
        if (opt && opt.dataZoom && opt.dataZoom.length > 0) {
            const dz = opt.dataZoom[0];
            if (dz.startValue !== undefined && typeof dz.startValue === 'number' && dz.startValue >= 0) {
                startIndex = Math.max(0, Math.min(currentValuationAllDates.length - 1, Math.round(dz.startValue)));
                endIndex = Math.max(startIndex, Math.min(currentValuationAllDates.length - 1, Math.round(dz.endValue)));
            } else if (dz.start !== undefined && dz.end !== undefined) {
                startIndex = Math.max(0, Math.min(currentValuationAllDates.length - 1, Math.floor((dz.start / 100) * (currentValuationAllDates.length - 1))));
                endIndex = Math.max(startIndex, Math.min(currentValuationAllDates.length - 1, Math.ceil((dz.end / 100) * (currentValuationAllDates.length - 1))));
            }
        }
    }

    const startDate = currentValuationAllDates[startIndex] || '';
    const endDate = currentValuationAllDates[endIndex] || '';

    const startYearMatch = String(startDate).match(/^(\d{4})/);
    const endYearMatch = String(endDate).match(/^(\d{4})/);
    const startYear = startYearMatch ? startYearMatch[1] : (startDate ? startDate.substring(0, 4) : '');
    const endYear = endYearMatch ? endYearMatch[1] : (endDate ? endDate.substring(0, 4) : '');

    let yearRangeText = "";
    if (startYear && endYear) {
        yearRangeText = `${startYear}年至${endYear}年`;
    } else if (startYear || endYear) {
        yearRangeText = `${startYear || endYear}年`;
    } else {
        yearRangeText = "横轴区间";
    }

    return { startIndex, endIndex, startDate, endDate, startYear, endYear, yearRangeText };
}

// 动态刷新图表顶部的标题与横轴年份区间徽章
function updateValuationHeaderUI(rangeInfo) {
    if (!rangeInfo) rangeInfo = getVisibleValuationDateRange();
    const titleDom = document.getElementById("valuation-chart-title");
    const badgeDom = document.getElementById("valuation-chart-range-badge");
    const subDom = document.getElementById("valuation-chart-subtext");

    const metricName = currentValuationMetric === 'pe' ? '市盈率 (PE-TTM)' : '市净率 (PB)';
    const periodNameMap = { day: "日线", week: "周线", month: "月线", year: "年线" };
    const pLabel = periodNameMap[currentValuationPeriod] || "日线";

    if (titleDom) {
        titleDom.innerText = `多板块历史 ${metricName} [${pLabel}] 走势对比`;
    }
    if (badgeDom) {
        badgeDom.innerText = `(${rangeInfo.yearRangeText})`;
        badgeDom.style.display = rangeInfo.yearRangeText ? "inline-block" : "none";
    }
    if (subDom) {
        subDom.innerHTML = `📅 横轴可见时间: <b style="color:#e2e8f0;">${rangeInfo.startDate || '--'} ~ ${rangeInfo.endDate || '--'}</b> <span style="margin-left:6px; color:#64748b;">(拖动下方滑块联动估算)</span>`;
    }
}

// 根据横轴长度与时间段动态估算各板块 PE / PB 百分位数与极值并渲染汇总表格
function updateValuationSummaryTable(rangeInfo) {
    if (!rangeInfo) rangeInfo = getVisibleValuationDateRange();
    updateValuationHeaderUI(rangeInfo);
    const tbody = document.getElementById("valuation-summary-tbody");
    if (!tbody) return;

    if (!currentValuationDataMap || Object.keys(currentValuationDataMap).length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:#94a3b8; padding:25px;">暂无对比板块，请在上方搜索或选择添加板块（支持单个或多个板块）</td></tr>`;
        return;
    }

    // 更新表头文本，带上动态年份段
    const thPeRange = document.getElementById("th-val-pe-range");
    const thPePct = document.getElementById("th-val-pe-pct");
    const thPbRange = document.getElementById("th-val-pb-range");
    const thPbPct = document.getElementById("th-val-pb-pct");

    if (thPeRange) thPeRange.innerHTML = `PE 历史最低/最高<br><span style="font-size:11px; font-weight:normal; color:#94a3b8">(${rangeInfo.yearRangeText})</span>`;
    if (thPePct) thPePct.innerHTML = `PE 历史百分位<br><span style="font-size:11px; font-weight:normal; color:#38bdf8">(${rangeInfo.yearRangeText})</span>`;
    if (thPbRange) thPbRange.innerHTML = `PB 历史最低/最高<br><span style="font-size:11px; font-weight:normal; color:#94a3b8">(${rangeInfo.yearRangeText})</span>`;
    if (thPbPct) thPbPct.innerHTML = `PB 历史百分位<br><span style="font-size:11px; font-weight:normal; color:#38bdf8">(${rangeInfo.yearRangeText})</span>`;

    const palette = ['#38bdf8', '#f59e0b', '#ef4444', '#10b981', '#a855f7', '#ec4899', '#6366f1', '#14b8a6', '#06b6d4', '#84cc16'];
    let colorIdx = 0;
    let tbodyHtml = "";

    for (const code in currentValuationDataMap) {
        const item = currentValuationDataMap[code];
        const color = palette[colorIdx % palette.length];
        colorIdx++;

        const history = item.history || [];
        // 筛选横轴时间段内的历史数据点
        const historyInRange = history.filter(h => {
            if (!h.trade_date) return false;
            return (!rangeInfo.startDate || h.trade_date >= rangeInfo.startDate) &&
                   (!rangeInfo.endDate || h.trade_date <= rangeInfo.endDate);
        });

        const targetHistory = historyInRange.length > 0 ? historyInRange : history;
        const peList = targetHistory.map(h => h.pe_ratio).filter(v => v !== null && v !== undefined && !isNaN(v));
        const pbList = targetHistory.map(h => h.pb_ratio).filter(v => v !== null && v !== undefined && !isNaN(v));

        const currPe = item.current_pe !== undefined ? item.current_pe : (peList.length > 0 ? peList[peList.length - 1] : '--');
        const currPb = item.current_pb !== undefined ? item.current_pb : (pbList.length > 0 ? pbList[pbList.length - 1] : '--');

        const minPe = peList.length > 0 ? Math.min(...peList) : currPe;
        const maxPe = peList.length > 0 ? Math.max(...peList) : currPe;
        const minPb = pbList.length > 0 ? Math.min(...pbList) : currPb;
        const maxPb = pbList.length > 0 ? Math.max(...pbList) : currPb;

        // 根据横轴长度估算百分比（横轴时间段内的 PE / PB 分位数占比）
        let pePercentile = 50.0;
        if (peList.length > 0 && currPe !== '--') {
            const countPeLess = peList.filter(v => v <= currPe).length;
            pePercentile = Math.round((countPeLess / peList.length) * 1000) / 10;
        }

        let pbPercentile = 50.0;
        if (pbList.length > 0 && currPb !== '--') {
            const countPbLess = pbList.filter(v => v <= currPb).length;
            pbPercentile = Math.round((countPbLess / pbList.length) * 1000) / 10;
        }

        // 估值定位评价
        let evalTag = `<span class="tag tag-gold">估值适中</span>`;
        if (pePercentile <= 20) {
            evalTag = `<span class="tag tag-blue">极低估 具备高安全边际</span>`;
        } else if (pePercentile >= 80) {
            evalTag = `<span class="tag tag-red">历史偏高警惕透支</span>`;
        }

        tbodyHtml += `
        <tr>
            <td>${item.sector_code}</td>
            <td><b style="color:${color}">${item.sector_name}</b></td>
            <td>
                <b style="color:#ef4444">${currPe}</b> 
                <span style="font-size:11px; color:#94a3b8">(${rangeInfo.yearRangeText})</span>
            </td>
            <td>${typeof minPe === 'number' ? minPe.toFixed(2) : minPe} ~ ${typeof maxPe === 'number' ? maxPe.toFixed(2) : maxPe}</td>
            <td>
                <span class="tag ${pePercentile <= 30 ? 'tag-blue' : (pePercentile >= 70 ? 'tag-red' : 'tag-gold')}">${pePercentile}%</span> 
                <span style="font-size:11px; color:#94a3b8; margin-left:3px;">(${rangeInfo.yearRangeText})</span>
            </td>
            <td>
                <b style="color:#f59e0b">${currPb}</b> 
                <span style="font-size:11px; color:#94a3b8">(${rangeInfo.yearRangeText})</span>
            </td>
            <td>${typeof minPb === 'number' ? minPb.toFixed(2) : minPb} ~ ${typeof maxPb === 'number' ? maxPb.toFixed(2) : maxPb}</td>
            <td>
                <span class="tag ${pbPercentile <= 30 ? 'tag-blue' : (pbPercentile >= 70 ? 'tag-red' : 'tag-gold')}">${pbPercentile}%</span> 
                <span style="font-size:11px; color:#94a3b8; margin-left:3px;">(${rangeInfo.yearRangeText})</span>
            </td>
            <td>${evalTag}</td>
            <td><button class="chart-tab-btn" style="padding:2px 8px; font-size:11px" onclick="removeSectorFromComparison('${item.sector_code}')">移除</button></td>
        </tr>`;
    }

    tbody.innerHTML = tbodyHtml;
}

async function renderValuationComparison() {
    const chartDom = document.getElementById('valuation-chart');

    // 清空或无板块状态处理：彻底销毁旧实例并重置 DOM
    if (!chosenSectorsForValuation || chosenSectorsForValuation.length === 0) {
        if (valuationChartInstance) {
            valuationChartInstance.dispose();
            valuationChartInstance = null;
        }
        if (chartDom) {
            chartDom.innerHTML = `<div style="display:flex; justify-content:center; align-items:center; height:100%; color:#94a3b8; font-size:14px;">已清空所选板块。请在上方下拉选择或输入拼音/名称添加板块（支持单个或多个板块对比）</div>`;
        }
        currentValuationDataMap = null;
        currentValuationAllDates = [];
        updateValuationSummaryTable(null);
        return;
    }

    if (!chartDom) return;

    try {
        const url = `/api/sectors/valuation_comparison?codes=${chosenSectorsForValuation.join(',')}&period=${currentValuationPeriod}`;
        const res = await fetch(url);
        const json = await res.json();
        if (json.status !== "success" || !json.data) return;

        const dataMap = json.data;
        currentValuationDataMap = dataMap;

        // 收集所有有效日期并排序（确保所有板块无论起止日期都能在横轴精确对齐）
        const dateSet = new Set();
        for (const code in dataMap) {
            const history = dataMap[code].history || [];
            history.forEach(h => {
                if (h.trade_date) dateSet.add(h.trade_date);
            });
        }
        currentValuationAllDates = Array.from(dateSet).sort();
        const allDates = currentValuationAllDates;

        // 关键修复：确保 ECharts 实例与 DOM 容器重新干净绑定，避免清空后 innerHTML 破坏导致无数据
        let inst = echarts.getInstanceByDom(chartDom);
        if (!inst || !valuationChartInstance) {
            if (inst) inst.dispose();
            if (valuationChartInstance) valuationChartInstance.dispose();
            chartDom.innerHTML = "";
            valuationChartInstance = echarts.init(chartDom, 'dark');
            window.addEventListener('resize', () => {
                if (valuationChartInstance) valuationChartInstance.resize();
            });
        } else {
            valuationChartInstance = inst;
        }

        const seriesList = [];
        const legendData = [];
        const palette = ['#38bdf8', '#f59e0b', '#ef4444', '#10b981', '#a855f7', '#ec4899', '#6366f1', '#14b8a6', '#06b6d4', '#84cc16'];
        let colorIdx = 0;

        for (const code in dataMap) {
            const item = dataMap[code];
            const color = palette[colorIdx % palette.length];
            colorIdx++;

            legendData.push(item.sector_name);
            const history = item.history || [];
            const dateValueMap = {};
            history.forEach(h => {
                dateValueMap[h.trade_date] = currentValuationMetric === 'pe' ? h.pe_ratio : h.pb_ratio;
            });

            // 映射到全量日期轴，保持数据点严密对齐
            const values = allDates.map(d => dateValueMap[d] !== undefined ? dateValueMap[d] : null);

            seriesList.push({
                name: item.sector_name,
                type: 'line',
                data: values,
                connectNulls: true,
                smooth: true,
                showSymbol: false,
                lineStyle: { width: 2.5, color: color },
                itemStyle: { color: color }
            });
        }

        const initialRangeInfo = getVisibleValuationDateRange();
        const metricName = currentValuationMetric === 'pe' ? '市盈率 (PE-TTM)' : '市净率 (PB)';
        const periodNameMap = { day: "日线", week: "周线", month: "月线", year: "年线" };
        const pLabel = periodNameMap[currentValuationPeriod] || "日线";

        const option = {
            backgroundColor: 'transparent',
            title: {
                show: false
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'cross' },
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                borderColor: '#38bdf8',
                borderWidth: 1,
                padding: [10, 14],
                textStyle: { color: '#f8fafc', fontSize: 12 },
                formatter: function (params) {
                    if (!params || params.length === 0) return '';
                    const dateStr = params[0].axisValue;
                    const curRange = getVisibleValuationDateRange();
                    let html = `<div style="font-weight:700; color:#38bdf8; margin-bottom:8px; border-bottom:1px solid #334155; padding-bottom:4px;">📅 时间: ${dateStr} <span style="font-size:11px; color:#94a3b8; font-weight:normal;">(${curRange.yearRangeText})</span></div>`;
                    
                    params.forEach(p => {
                        const secName = p.seriesName;
                        let foundCode = null;
                        for (const c in dataMap) {
                            if (dataMap[c].sector_name === secName) {
                                foundCode = c;
                                break;
                            }
                        }
                        const secData = foundCode ? dataMap[foundCode] : null;
                        const hItem = secData && secData.history ? secData.history.find(h => h.trade_date === dateStr) : null;
                        const colorDot = `<span style="display:inline-block;margin-right:6px;border-radius:50%;width:9px;height:9px;background-color:${p.color};"></span>`;
                        
                        if (hItem) {
                            const peVal = hItem.pe_ratio !== undefined ? hItem.pe_ratio : '--';
                            const pbVal = hItem.pb_ratio !== undefined ? hItem.pb_ratio : '--';
                            const pePct = hItem.pe_percentile !== undefined ? hItem.pe_percentile + '%' : '--';
                            const pbPct = hItem.pb_percentile !== undefined ? hItem.pb_percentile + '%' : '--';
                            
                            html += `
                            <div style="margin: 6px 0; line-height: 1.5;">
                                <div>${colorDot}<b style="color:${p.color}">${secName}</b>:</div>
                                <div style="padding-left:15px; color:#cbd5e1; font-size:11px;">
                                    <span>PE: <b style="color:#ef4444">${peVal}</b> (分位: <span style="color:#f59e0b">${pePct}</span> [${curRange.yearRangeText}])</span>
                                    <span style="margin-left:12px;">PB: <b style="color:#38bdf8">${pbVal}</b> (分位: <span style="color:#f59e0b">${pbPct}</span> [${curRange.yearRangeText}])</span>
                                </div>
                            </div>`;
                        } else {
                            html += `<div>${colorDot}${secName}: <b>${p.value !== null ? p.value : '--'}</b></div>`;
                        }
                    });
                    return html;
                }
            },
            legend: {
                data: legendData,
                top: '2%',
                right: '2%',
                textStyle: { color: '#cbd5e1' }
            },
            grid: { 
                left: '3%', 
                right: '3%', 
                bottom: '12%', 
                top: '8%', 
                containLabel: true 
            },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: allDates,
                axisLine: { lineStyle: { color: '#475569' } },
                axisLabel: { 
                    color: '#94a3b8',
                    rotate: 0,
                    interval: 'auto'
                }
            },
            yAxis: {
                type: 'value',
                name: metricName,
                nameTextStyle: { color: '#94a3b8' },
                scale: true,
                splitLine: { lineStyle: { color: '#233152' } },
                axisLabel: { color: '#94a3b8' }
            },
            dataZoom: [
                {
                    type: 'inside',
                    xAxisIndex: 0,
                    start: 0,
                    end: 100,
                    zoomOnMouseWheel: true,
                    moveOnMouseMove: true,
                    filterMode: 'filter'
                },
                {
                    type: 'slider',
                    xAxisIndex: 0,
                    bottom: '1%',
                    height: 24,
                    start: 0,
                    end: 100,
                    borderColor: '#334155',
                    fillerColor: 'rgba(56, 189, 248, 0.25)',
                    handleStyle: { color: '#38bdf8' },
                    textStyle: { color: '#94a3b8' },
                    filterMode: 'filter'
                }
            ],
            series: seriesList
        };

        valuationChartInstance.setOption(option, true);

        // 监听 dataZoom 缩放/拖动事件：横轴拖动时，上方走势图与下方估值汇总表格同步无延迟跟随变动
        valuationChartInstance.off('dataZoom');
        let zoomTimer = null;
        valuationChartInstance.on('dataZoom', function (params) {
            clearTimeout(zoomTimer);
            zoomTimer = setTimeout(() => {
                let startVal = undefined, endVal = undefined;
                if (params) {
                    if (params.batch && params.batch.length > 0) {
                        startVal = params.batch[0].start;
                        endVal = params.batch[0].end;
                    } else if (params.start !== undefined && params.end !== undefined) {
                        startVal = params.start;
                        endVal = params.end;
                    }
                }
                const curRange = getVisibleValuationDateRange(startVal, endVal);
                updateValuationSummaryTable(curRange);
            }, 30);
        });

        // 初始立即渲染表格统计数据
        updateValuationSummaryTable(initialRangeInfo);

        // 绑定点击事件：点击图表中任意点，显示历史 PE、PB 分数值，并支持从当前时点/任意年份直接修改分数值
        valuationChartInstance.off('click');
        valuationChartInstance.on('click', function (params) {
            const dateStr = params.name || (allDates && allDates[params.dataIndex]);
            if (!dateStr) return;
            const curRange = getVisibleValuationDateRange();
            
            let modalHtml = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <div style="font-size:14px; color:#38bdf8; font-weight:700;">
                    📊 【${dateStr}】各板块历史估值快照与分数值修改 (${curRange.yearRangeText})
                </div>
                <div style="font-size:11px; color:#94a3b8;">
                    💡 支持修改任意年份/时点的 PE、PB 分数值，点击“保存修改”即刻重算走势与百分位
                </div>
            </div>`;

            modalHtml += `
            <div style="overflow-x:auto;">
            <table style="width:100%; font-size:12px; border-collapse:collapse;">
                <tr style="border-bottom:1px solid #334155; color:#94a3b8;">
                    <th style="text-align:left; padding:6px;">板块名称</th>
                    <th style="text-align:center; padding:6px;">历史PE分数值</th>
                    <th style="text-align:center; padding:6px;">当前PE分位数 (${curRange.yearRangeText})</th>
                    <th style="text-align:center; padding:6px;">历史PB分数值</th>
                    <th style="text-align:center; padding:6px;">当前PB分位数 (${curRange.yearRangeText})</th>
                    <th style="text-align:center; padding:6px;">修改估值分数值 (PE / PB)</th>
                    <th style="text-align:center; padding:6px;">操作</th>
                </tr>`;
            
            for (const c in dataMap) {
                const sec = dataMap[c];
                const hItem = sec.history ? sec.history.find(h => h.trade_date === dateStr) : null;
                if (hItem) {
                    const rowId = `edit-val-${sec.sector_code}-${dateStr.replace(/[^a-zA-Z0-9]/g, '_')}`;
                    modalHtml += `
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
                        <td style="padding:8px 6px; font-weight:700; color:#e2e8f0;">
                            ${sec.sector_name}
                            <span style="font-size:11px; color:#94a3b8; font-weight:normal;">(${sec.sector_code})</span>
                        </td>
                        <td style="padding:8px 6px; text-align:center; color:#ef4444; font-weight:700; font-size:13px;">${hItem.pe_ratio}</td>
                        <td style="padding:8px 6px; text-align:center;"><span class="tag tag-gold">${hItem.pe_percentile}% (${curRange.yearRangeText})</span></td>
                        <td style="padding:8px 6px; text-align:center; color:#38bdf8; font-weight:700; font-size:13px;">${hItem.pb_ratio}</td>
                        <td style="padding:8px 6px; text-align:center;"><span class="tag tag-blue">${hItem.pb_percentile}% (${curRange.yearRangeText})</span></td>
                        <td style="padding:8px 6px; text-align:center;">
                            <div style="display:inline-flex; gap:6px; align-items:center;">
                                <input type="number" step="0.01" id="${rowId}-pe" class="custom-select" style="width:75px; padding:3px 6px; font-size:12px; text-align:center;" value="${hItem.pe_ratio}" placeholder="新PE">
                                <input type="number" step="0.01" id="${rowId}-pb" class="custom-select" style="width:75px; padding:3px 6px; font-size:12px; text-align:center;" value="${hItem.pb_ratio}" placeholder="新PB">
                            </div>
                        </td>
                        <td style="padding:8px 6px; text-align:center;">
                            <button class="primary-btn" style="padding:3px 10px; font-size:11px;" 
                                onclick="saveCustomSectorValuation('${sec.sector_code}', '${dateStr}', '${rowId}-pe', '${rowId}-pb')">
                                💾 保存修改
                            </button>
                        </td>
                    </tr>`;
                }
            }
            modalHtml += `</table></div>`;
            
            // 展示在图表上方的临时信息条中
            let infoBox = document.getElementById("valuation-point-detail-box");
            if (!infoBox) {
                infoBox = document.createElement("div");
                infoBox.id = "valuation-point-detail-box";
                infoBox.style.cssText = "margin: 12px 0; padding: 14px 18px; background: rgba(15, 23, 42, 0.98); border: 1px solid #38bdf8; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.6);";
                chartDom.parentNode.insertBefore(infoBox, chartDom);
            }
            infoBox.innerHTML = modalHtml;
            infoBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
    } catch (e) {
        console.error("渲染板块估值对比失败:", e);
    }
}

// 保存用户自定义修改的板块分数值
async function saveCustomSectorValuation(sectorCode, tradeDate, peInputId, pbInputId) {
    const peVal = document.getElementById(peInputId)?.value;
    const pbVal = document.getElementById(pbInputId)?.value;

    if (peVal === "" || pbVal === "") {
        alert("请输入有效的 PE 和 PB 分数值！");
        return;
    }

    try {
        const res = await fetch("/api/sectors/update_valuation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                sector_code: sectorCode,
                trade_date: tradeDate,
                pe_ratio: parseFloat(peVal),
                pb_ratio: parseFloat(pbVal)
            })
        });
        const json = await res.json();
        if (json.status === "success") {
            // 重新刷新图表，使修改的分数值立即在走势曲线与分位数中生效
            await renderValuationComparison();
            // 保持修改提示框处于当前时点
            const currentClickSim = { name: tradeDate };
            valuationChartInstance.trigger('click', currentClickSim);
        } else {
            alert("修改失败: " + (json.message || "未知错误"));
        }
    } catch (e) {
        console.error("保存估值分数值异常:", e);
        alert("保存异常，请检查网络！");
    }
}

// 8. 盘中强势板块与盘中龙1/2/3
async function loadIntradayStrong() {
    try {
        const res = await fetch("/api/realtime/intraday");
        const json = await res.json();
        if (json.status !== "success") return;

        const container = document.getElementById("intraday-strong-list");
        let html = "";
        json.top_intraday_sectors.forEach((sec, idx) => {
            const dragons = sec.intraday_dragons.map(d => 
                `<span style="margin-right:8px"><a class="stock-link" onclick="openStockChartModal('${d.stock_code}', '${d.stock_name}')">${d.is_dragon_rank === 1 ? '👑' : '⚡'} ${d.stock_name}</a> (+${d.change_percent}%)</span>`
            ).join('');

            html += `
            <div class="rank-list-item" style="flex-direction:column; align-items:flex-start; gap:6px">
                <div style="display:flex; justify-content:space-between; width:100%">
                    <span><b style="color:#38bdf8">${sec.sector_name}</b> <span class="tag tag-period">${sec.launch_period}</span></span>
                    <span class="tag tag-red">+${sec.change_percent}%</span>
                </div>
                <div style="font-size:12px; color:#cbd5e1">${dragons}</div>
            </div>`;
        });
        container.innerHTML = html;
    } catch (e) {
        console.error("加载盘中强势板块失败:", e);
    }
}

// 9. 果仁网多因子量化选股池
async function loadQuantFactors() {
    try {
        const res = await fetch("/api/quant/factors");
        const json = await res.json();
        if (json.status !== "success") return;

        const tbody = document.getElementById("quant-tbody");
        let html = "";
        json.data.forEach(item => {
            html += `
            <tr>
                <td><a class="stock-link" onclick="openStockChartModal('${item.stock_code}', '${item.stock_name}')">${item.stock_code}</a></td>
                <td><a class="stock-link" onclick="openStockChartModal('${item.stock_code}', '${item.stock_name}')"><b>${item.stock_name}</b></a></td>
                <td><span style="color:#ef4444">+${item.momentum_20d}%</span></td>
                <td><span style="color:#f59e0b">+${item.momentum_60d}%</span></td>
                <td>${item.volatility_factor}%</td>
                <td>${item.pe_percentile}%</td>
                <td>${item.growth_score}</td>
                <td><b style="color:#38bdf8">${item.composite_score}</b></td>
            </tr>`;
        });
        tbody.innerHTML = html;
    } catch (e) {
        console.error("加载果仁多因子失败:", e);
    }
}

// 10. 社区情绪排行
async function loadSentimentRanking() {
    try {
        const res = await fetch("/api/sentiment/ranking");
        const json = await res.json();
        if (json.status !== "success") return;

        const container = document.getElementById("sentiment-list");
        let html = "";
        json.data.forEach(item => {
            html += `
            <div class="rank-list-item">
                <div>
                    <span class="rank-index ${item.rank_order <= 3 ? 'rank-top' + item.rank_order : ''}">${item.rank_order}</span>
                    <a class="stock-link" onclick="openStockChartModal('${item.stock_code}', '${item.stock_name}')"><b>${item.stock_name}</b></a> <span style="font-size:11px; color:#94a3b8">(${item.stock_code})</span>
                </div>
                <div>
                    <span class="tag tag-gold" style="margin-right:6px">热度 ${item.heat_score}</span>
                    <span class="tag tag-blue">${item.sentiment_tag}</span>
                </div>
            </div>`;
        });
        container.innerHTML = html;
    } catch (e) {
        console.error("加载社区情绪失败:", e);
    }
}

// 11. 龙虎榜
async function loadDragonTiger() {
    try {
        const res = await fetch("/api/events/dragon_tiger");
        const json = await res.json();
        if (json.status !== "success") return;

        const tbody = document.getElementById("dragontiger-tbody");
        let html = "";
        json.data.forEach(item => {
            const netAmt = item.billboard_net_amt;
            const isBuy = netAmt >= 0;
            html += `
            <tr>
                <td>${item.trade_date}</td>
                <td><a class="stock-link" onclick="openStockChartModal('${item.security_code}', '${item.security_name}')">${item.security_code}</a></td>
                <td><a class="stock-link" onclick="openStockChartModal('${item.security_code}', '${item.security_name}')"><b>${item.security_name}</b></a></td>
                <td>¥${item.close_price}</td>
                <td style="color:${item.change_rate >= 0 ? '#ef4444' : '#10b981'}">${item.change_rate.toFixed(2)}%</td>
                <td style="color:${isBuy ? '#ef4444' : '#10b981'}; font-weight:700">${isBuy ? '+' : ''}${netAmt} 万</td>
                <td>${item.buy_amt} 万</td>
                <td>${item.sell_amt} 万</td>
                <td style="font-size:12px; color:#cbd5e1">${item.explanation}</td>
            </tr>`;
        });
        tbody.innerHTML = html;
    } catch (e) {
        console.error("加载龙虎榜失败:", e);
    }
}

// 切换标签页 (盘中异动 vs 舆情)
function switchTab(tabId) {
    document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
    document.getElementById("btn-" + tabId).classList.add("active");

    document.getElementById("tab-intraday").style.display = tabId === 'intraday' ? 'block' : 'none';
    document.getElementById("tab-sentiment").style.display = tabId === 'sentiment' ? 'block' : 'none';
}

// 手动触发全量刷新
async function refreshAllData() {
    const btn = document.getElementById("refresh-action-btn");
    btn.innerText = "正在拉取全量数据...";
    btn.disabled = true;
    try {
        const res = await fetch("/api/system/refresh", { method: "POST" });
        const json = await res.json();
        alert(json.message || "刷新完成！");
        location.reload();
    } catch (e) {
        alert("刷新失败: " + e);
    } finally {
        btn.innerText = "🔄 全量抓取与分析";
        btn.disabled = false;
    }
}
