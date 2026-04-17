# 台股 AI 分析工具

整合 Yahoo Finance 即時報價 + Claude AI 智慧分析的台股儀表板。

## 功能
- 📡 Yahoo Finance 即時股價（每 60 秒自動刷新）
- 🤖 Claude AI 技術面 + 基本面 + 市場情緒綜合分析
- 📈 信心值預測：看漲 / 看跌 / 盤整
- 📰 AI 彙整相關新聞
- ⚡ 側邊欄常用股票快速報價
- 🔒 API Key 藏在伺服器，用戶無需輸入任何 Key

## 專案結構
```
taiwan-stock/
├── index.html          # 前端主頁（無需 API Key）
├── api/
│   ├── quote.js        # Proxy → Yahoo Finance（解決 CORS）
│   └── analyze.js      # Proxy → Claude API（隱藏 API Key）
├── vercel.json         # Vercel 路由設定
├── package.json
└── README.md
```

## 部署到 Vercel

### Step 1：上傳專案
1. 前往 https://vercel.com → New Project
2. 上傳此資料夾（或推到 GitHub 再 import）
3. Framework Preset 選「Other」→ Deploy

### Step 2：設定環境變數（重要）
部署完成後：
1. Vercel 後台 → 你的專案 → **Settings → Environment Variables**
2. 新增：
   - Name：`ANTHROPIC_API_KEY`
   - Value：`sk-ant-xxxxxxx`（你的 Claude API Key）
3. 儲存後點 **Deployments → Redeploy**

### Step 3：完成
打開 Vercel 給的網址，任何人都可以直接使用，無需輸入 API Key。

## 取得 Anthropic API Key
前往 https://console.anthropic.com 申請，新帳號有免費額度。

## 注意事項
- AI 分析為估計值，不構成投資建議
- Yahoo Finance 為非官方 API，穩定性視對方調整而定
- 若開放給大量用戶使用，建議在 Vercel 設定 rate limit 保護
