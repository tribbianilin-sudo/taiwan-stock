// api/quote.js — Vercel Serverless Function
// 代理 Yahoo Finance API，解決 CORS 問題
// 台股代號格式：2330.TW（上市）、6547.TWO（上櫃）

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { symbol } = req.query;
  if (!symbol) {
    return res.status(400).json({ error: '請提供股票代號，例如 ?symbol=2330.TW' });
  }

  try {
    // FIX: range 改為 1mo，確保連假也能取得足夠的 sparkline 資料
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1mo`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
        'Referer': 'https://finance.yahoo.com/',
        'Origin': 'https://finance.yahoo.com',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Yahoo Finance 回應錯誤: ${response.status}` });
    }

    const data = await response.json();
    const result = data?.chart?.result?.[0];

    if (!result) {
      return res.status(404).json({ error: '找不到該股票資料，請確認代號是否正確' });
    }

    const meta = result.meta;
    const quotes = result.indicators?.quote?.[0];
    const timestamps = result.timestamp || [];

    const closes  = quotes?.close  || [];
    const opens   = quotes?.open   || [];
    const highs   = quotes?.high   || [];
    const lows    = quotes?.low    || [];
    const volumes = quotes?.volume || [];

    const lastIdx = closes.length - 1;

    // FIX: 使用 ?? 而非 ||，避免 0 被視為 falsy；加 null 防護
    const prevClose    = meta.chartPreviousClose ?? meta.previousClose ?? closes[lastIdx - 1] ?? null;
    const currentPrice = meta.regularMarketPrice ?? closes[lastIdx] ?? null;

    // FIX: null 防護，避免 undefined.toFixed() crash
    const safeFixed = (n, d = 2) => (n != null ? +Number(n).toFixed(d) : null);

    const change    = (currentPrice != null && prevClose != null)
      ? +Number(currentPrice - prevClose).toFixed(2) : 0;
    const changePct = prevClose
      ? +((change / prevClose) * 100).toFixed(2) : 0;

    // FIX: 52 週高低只從 meta 取，不再 fallback 到 5 天 OHLC（那是錯的）
    const week52High = meta.fiftyTwoWeekHigh ?? null;
    const week52Low  = meta.fiftyTwoWeekLow  ?? null;

    return res.status(200).json({
      symbol:            meta.symbol,
      shortName:         meta.shortName || meta.symbol,
      currency:          meta.currency  || 'TWD',
      marketState:       meta.marketState || 'CLOSED',   // REGULAR / PRE / POST / CLOSED
      exchangeName:      meta.exchangeName,
      regularMarketTime: meta.regularMarketTime,
      price:             safeFixed(currentPrice),
      previousClose:     safeFixed(prevClose),
      change,
      changePct,
      open:      safeFixed(opens[lastIdx]),
      high:      safeFixed(highs[lastIdx]),
      low:       safeFixed(lows[lastIdx]),
      volume:    volumes[lastIdx] || null,
      week52High: safeFixed(week52High),
      week52Low:  safeFixed(week52Low),
      // 歷史收盤（近 1 個月，供 sparkline；過濾掉 null）
      history: timestamps.map((ts, i) => ({
        date:  new Date(ts * 1000).toLocaleDateString('zh-TW'),
        close: closes[i] != null ? safeFixed(closes[i]) : null,
      })).filter(d => d.close !== null),
    });

  } catch (err) {
    console.error('Yahoo Finance proxy error:', err);
    return res.status(500).json({ error: `伺服器錯誤: ${err.message}` });
  }
}
