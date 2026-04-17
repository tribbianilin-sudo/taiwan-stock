// api/analyze.js — Vercel Serverless Function
// 伺服器端呼叫 Claude API，API Key 存在 Vercel 環境變數，不暴露給前端

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: '伺服器未設定 ANTHROPIC_API_KEY 環境變數，請到 Vercel 後台設定。' });
  }

  const { liveData, period, resolveOnly, query } = req.body;

  // ── 模式 1：只解析中文名稱 → 股票代號 ──────────
  if (resolveOnly) {
    if (!query) return res.status(400).json({ error: '缺少 query 參數' });
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 20,
          messages: [{ role: 'user', content: `台股「${query}」的 4 位數代號是什麼？只回傳數字，不要其他文字。` }],
        }),
      });
      const data = await response.json();
      const code = data.content?.[0]?.text?.trim().match(/\d{4}/)?.[0];
      return res.status(200).json({ code: code || null });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── 模式 2：完整 AI 分析 ─────────────────────
  if (!liveData || !period) {
    return res.status(400).json({ error: '缺少必要參數 liveData 或 period' });
  }

  const systemPrompt = `你是一位台灣股市專業分析師 AI。我已提供來自 Yahoo Finance 的即時股價資料，請根據此資料進行分析，並以 JSON 格式回覆。

請務必只回傳 JSON，不要有任何其他文字、markdown 標記或說明。

JSON 格式如下：
{
  "code": "股票代號（不含 .TW）",
  "name": "公司中文名稱",
  "prediction": "up" | "down" | "neutral",
  "confidence": 整數（0-100），
  "verdictText": "看漲" | "看跌" | "盤整",
  "fundamentals": {
    "pe": 數字,
    "forwardPe": 數字,
    "pb": 數字,
    "eps": 數字,
    "dividendYield": 數字,
    "marketCap": "文字（如 51.87 兆）"
  },
  "technicals": [
    {"name": "RSI(14)", "value": "數值", "signal": "up|down|neutral"},
    {"name": "MACD", "value": "描述", "signal": "up|down|neutral"},
    {"name": "MA20", "value": "數值", "signal": "up|down|neutral"},
    {"name": "MA60", "value": "數值", "signal": "up|down|neutral"},
    {"name": "布林帶", "value": "位置", "signal": "up|down|neutral"},
    {"name": "KD(9)", "value": "K值", "signal": "up|down|neutral"},
    {"name": "成交量", "value": "描述", "signal": "up|down|neutral"},
    {"name": "外資", "value": "描述", "signal": "up|down|neutral"},
    {"name": "投信", "value": "描述", "signal": "up|down|neutral"}
  ],
  "news": [
    {"title": "新聞標題", "source": "來源", "time": "時間"},
    {"title": "新聞標題", "source": "來源", "time": "時間"},
    {"title": "新聞標題", "source": "來源", "time": "時間"},
    {"title": "新聞標題", "source": "來源", "time": "時間"}
  ],
  "aiAnalysis": "詳細分析文字，約 200 字，繁體中文，可用**粗體**強調，請注意目前股價為 Yahoo Finance 即時資料。",
  "sources": ["Yahoo Finance 即時報價", "技術指標", "基本面", "市場新聞"]
}`;

  const userMessage = `Yahoo Finance 即時資料：
代號：${liveData.symbol}
公司：${liveData.shortName}
目前股價：NT$${liveData.price}
漲跌：${liveData.change >= 0 ? '+' : ''}${liveData.change}（${liveData.changePct >= 0 ? '+' : ''}${liveData.changePct}%）
今日開盤：${liveData.open}
今日最高：${liveData.high}
今日最低：${liveData.low}
前一收盤：${liveData.previousClose}
52 週最高：${liveData.week52High}
52 週最低：${liveData.week52Low}
交易所：${liveData.exchangeName}
市場狀態：${liveData.marketState}
預測區間：${period}

請根據以上即時資料進行分析。`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err.error?.message || `Claude API 錯誤: ${response.status}` });
    }

    const data = await response.json();
    const text = data.content?.map(b => b.text || '').join('') || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'AI 回傳格式錯誤' });

    const parsed = JSON.parse(jsonMatch[0]);
    return res.status(200).json(parsed);

  } catch (err) {
    console.error('analyze error:', err);
    return res.status(500).json({ error: `伺服器錯誤: ${err.message}` });
  }
}
