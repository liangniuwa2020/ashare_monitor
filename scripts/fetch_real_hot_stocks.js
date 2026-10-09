const crypto = require('crypto');
const https = require('https');
const http = require('http');

const md5_key = crypto.createHash('md5').update('getUtilsFromFile').digest('hex');
const iv = Buffer.from('getClassFromFile', 'utf-8');

function fetchPop(type, sort, page) {
    return new Promise((resolve) => {
        const req = https.get({
            hostname: 'gbcdn.dfcfw.com',
            path: `/rank/popularityList.js?type=${type}&sort=${sort}&page=${page}&m=10`,
            headers: { 'Referer': 'https://guba.eastmoney.com/' },
            timeout: 5000
        }, (res) => {
            let raw = '';
            res.on('data', c => raw += c);
            res.on('end', () => {
                const match = raw.match(/var popularityList='([^']+)'/);
                if (!match) return resolve([]);
                try {
                    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(md5_key, 'utf-8'), iv);
                    let decrypted = decipher.update(match[1], 'base64', 'utf8');
                    decrypted += decipher.final('utf8');
                    resolve(JSON.parse(decrypted));
                } catch (e) {
                    resolve([]);
                }
            });
        });
        req.on('error', () => resolve([]));
        req.on('timeout', () => { req.destroy(); resolve([]); });
    });
}

function fetchTopics(codes) {
    return new Promise((resolve) => {
        const req = https.get({
            hostname: 'gbcdn.dfcfw.com',
            path: `/rank/interface/GetData.js?needClick=1&codes=${codes}&path=newtopic/api/Topic/GubaCodeHotTopicNewRead&cb=topicList`,
            headers: { 'Referer': 'https://guba.eastmoney.com/' },
            timeout: 5000
        }, (res) => {
            let raw = '';
            res.on('data', c => raw += c);
            res.on('end', () => {
                const match = raw.match(/var topicList=\[({"re":.*})\]/s);
                if (match) {
                    try {
                        const parsed = JSON.parse(match[1]);
                        resolve(parsed.re || {});
                    } catch (e) {
                        resolve({});
                    }
                } else {
                    resolve({});
                }
            });
        });
        req.on('error', () => resolve({}));
        req.on('timeout', () => { req.destroy(); resolve({}); });
    });
}

function fetchGubaPosts(code) {
    return new Promise((resolve) => {
        const req = https.get({
            hostname: 'guba.eastmoney.com',
            path: `/list,${code}.html`,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            timeout: 3500
        }, (res) => {
            let raw = '';
            res.on('data', c => raw += c);
            res.on('end', () => {
                const titles = [];
                const reg = /"post_title":"([^"]+)"/g;
                let m;
                while ((m = reg.exec(raw)) !== null) {
                    const t = m[1].trim();
                    if (t && !t.includes('龙虎榜数据(') && !t.includes('每日量化复盘') && !titles.includes(t)) {
                        titles.push(t);
                        if (titles.length >= 2) break;
                    }
                }
                resolve(titles);
            });
        });
        req.on('error', () => resolve([]));
        req.on('timeout', () => { req.destroy(); resolve([]); });
    });
}

async function collectHot200() {
    // 1. Fetch sort=0 (人气榜 100), sort=1 (飙升榜 100), sort=2 (关注热榜 20)
    const [p0, p1, p2] = await Promise.all([
        Promise.all([1, 2, 3, 4, 5].map(p => fetchPop(0, 0, p))),
        Promise.all([1, 2, 3, 4, 5].map(p => fetchPop(0, 1, p))),
        Promise.all([1, 2].map(p => fetchPop(0, 2, p)))
    ]);

    const pop100 = p0.flat();
    const surge100 = p1.flat();
    const extra40 = p2.flat();

    const seen = new Set();
    const list = [];

    // Eastmoney popularity rank 1..100
    for (const item of pop100) {
        if (!seen.has(item.code)) {
            seen.add(item.code);
            list.push({
                stock_code: item.code,
                rank: list.length + 1,
                rank_change: item.changeNumber || 0,
                hot_score: Math.round(Number(item.history?.[item.history.length - 1]?.HOTRANKSCORE || 1000000) / 100000),
                source_tag: '东财全网人气榜',
                ironsFans: Number(item.ironsFans || 0),
                newFans: Number(item.newFans || 0)
            });
        }
    }

    // Eastmoney surge rank
    for (const item of surge100) {
        if (!seen.has(item.code)) {
            seen.add(item.code);
            list.push({
                stock_code: item.code,
                rank: list.length + 1,
                rank_change: item.changeNumber || 0,
                hot_score: Math.round(Number(item.history?.[item.history.length - 1]?.HOTRANKSCORE || 500000) / 100000),
                source_tag: '东财人气飙升榜',
                ironsFans: Number(item.ironsFans || 0),
                newFans: Number(item.newFans || 0)
            });
            if (list.length >= 200) break;
        }
    }

    // If still under 200, fill from extra
    if (list.length < 200) {
        for (const item of extra40) {
            if (!seen.has(item.code)) {
                seen.add(item.code);
                list.push({
                    stock_code: item.code,
                    rank: list.length + 1,
                    rank_change: item.changeNumber || 0,
                    hot_score: Math.round(Number(item.history?.[item.history.length - 1]?.HOTRANKSCORE || 300000) / 100000),
                    source_tag: '东财热议榜',
                    ironsFans: Number(item.ironsFans || 0),
                    newFans: Number(item.newFans || 0)
                });
                if (list.length >= 200) break;
            }
        }
    }

    // Fetch topics in batches of 50
    const codeList = list.slice(0, 200).map(x => x.stock_code);
    const topicsMap = {};
    for (let i = 0; i < codeList.length; i += 50) {
        const batch = codeList.slice(i, i + 50).join(',');
        const tObj = await fetchTopics(batch);
        Object.assign(topicsMap, tObj);
    }

    // Attach topics to stocks
    for (const item of list) {
        const tArr = topicsMap[item.stock_code];
        if (tArr && tArr.length > 0) {
            item.topic_title = tArr[0].name;
            item.topic_summary = tArr[0].summary;
        }
    }

    // For top 40 stocks without topic, fetch forum hot post titles concurrently
    const missingTopicTop = list.filter(x => !x.topic_title).slice(0, 40);
    await Promise.all(missingTopicTop.map(async (item) => {
        const posts = await fetchGubaPosts(item.stock_code);
        if (posts && posts.length > 0) {
            item.forum_posts = posts;
        }
    }));

    return list.slice(0, 200);
}

collectHot200().then(data => {
    process.stdout.write(JSON.stringify(data));
}).catch(err => {
    process.stderr.write(String(err));
    process.stdout.write(JSON.stringify([]));
});
