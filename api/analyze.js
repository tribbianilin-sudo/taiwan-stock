// api/analyze.js — Vercel Serverless Function
// 使用 Google Gemini API（免費方案可用）
// 環境變數：GEMINI_API_KEY

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: '伺服器未設定 GEMINI_API_KEY 環境變數，請到 Vercel 後台設定。' });
  }

  const { liveData, period, resolveOnly, query } = req.body;

  // ── 共用：呼叫 Gemini ─────────────────────────
  async function callGemini(prompt, maxTokens = 1500) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: 0.7,
        },
      }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || `Gemini API 錯誤: ${response.status}`);
    }
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  // ── 模式 1：解析中文名稱 → 股票代號 ────────────
  if (resolveOnly) {
    if (!query) return res.status(400).json({ error: '缺少 query 參數' });
    try {
      const text = await callGemini(
        `台股「${query}」的 4 位數代號是什麼？只回傳數字，不要其他文字。`,
        20
      );
      const code = text.trim().match(/\d{4}/)?.[0];
      return res.status(200).json({ code: code || null });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── 模式 2：完整 AI 分析 ─────────────────────
  if (!liveData || !period) {
    return res.status(400).json({ error: '缺少必要參數 liveData 或 period' });
  }

  const prompt = `你是一位台灣股市專業分析師 AI。我已提供來自 Yahoo Finance 的即時股價資料，請根據此資料進行分析。

請務必只回傳 JSON，不要有任何其他文字、markdown 標記（不要用 \`\`\`json）或說明。

Yahoo Finance 即時資料：
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

請回傳以下 JSON 格式（只回傳 JSON，其他什麼都不要）：
{
  "code": "股票代號（不含 .TW）",
  "name": "公司中文名稱",
  "prediction": "up 或 down 或 neutral",
  "confidence": 整數0到100,
  "verdictText": "看漲 或 看跌 或 盤整",
  "fundamentals": {
    "pe": 數字,
    "forwardPe": 數字,
    "pb": 數字,
    "eps": 數字,
    "dividendYield": 數字,
    "marketCap": "文字例如51.87兆"
  },
  "technicals": [
    {"name": "RSI(14)", "value": "數值", "signal": "up或down或neutral"},
    {"name": "MACD", "value": "描述", "signal": "up或down或neutral"},
    {"name": "MA20", "value": "數值", "signal": "up或down或neutral"},
    {"name": "MA60", "value": "數值", "signal": "up或down或neutral"},
    {"name": "布林帶", "value": "位置", "signal": "up或down或neutral"},
    {"name": "KD(9)", "value": "K值", "signal": "up或down或neutral"},
    {"name": "成交量", "value": "描述", "signal": "up或down或neutral"},
    {"name": "外資", "value": "描述", "signal": "up或down或neutral"},
    {"name": "投信", "value": "描述", "signal": "up或down或neutral"}
  ],
  "news": [
    {"title": "新聞標題1", "source": "來源", "time": "時間"},
    {"title": "新聞標題2", "source": "來源", "time": "時間"},
    {"title": "新聞標題3", "source": "來源", "time": "時間"},
    {"title": "新聞標題4", "source": "來源", "time": "時間"}
  ],
  "aiAnalysis": "詳細分析文字約200字，繁體中文，可用**粗體**強調重點",
  "sources": ["Yahoo Finance 即時報價", "技術指標", "基本面", "市場新聞"]
}`;

  try {
    const text = await callGemini(prompt, 1500);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'AI 回傳格式錯誤' });
    const parsed = JSON.parse(jsonMatch[0]);
    return res.status(200).json(parsed);
  } catch (err) {
    console.error('analyze error:', err);
    return res.status(500).json({ error: `伺服器錯誤: ${err.message}` });
  }
}
