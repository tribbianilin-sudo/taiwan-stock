# 台股 AI 分析工具

整合 Yahoo Finance 即時報價 + Google Gemini AI 智慧分析的台股儀表板。

## 功能
- 📡 Yahoo Finance 即時股價（每 60 秒自動刷新）
- 🤖 Gemini AI 技術面 + 基本面 + 市場情緒綜合分析（**免費**）
- 📈 信心值預測：看漲 / 看跌 / 盤整
- 📰 AI 彙整相關新聞
- ⚡ 側邊欄常用股票快速報價
- 🔒 API Key 藏在伺服器，用戶無需輸入任何 Key

## 專案結構
```
taiwan-stock/
├── index.html          # 前端主頁
├── api/
│   ├── quote.js        # Proxy → Yahoo Finance（解決 CORS）
│   └── analyze.js      # Proxy → Gemini API（隱藏 API Key）
├── vercel.json
├── package.json
└── README.md
```

## 部署到 Vercel

### Step 1：取得 Gemini API Key（免費）
1. 前往 https://aistudio.google.com/apikey
2. 登入 Google 帳號
3. 點「Create API Key」→ 複製

### Step 2：上傳專案
1. 前往 https://vercel.com → New Project
2. 上傳 taiwan-stock 資料夾
3. Framework Preset 選「Other」→ Deploy

### Step 3：設定環境變數
部署完成後：
1. Vercel 後台 → Settings → Environment Variables
2. 新增：
   - Name：`GEMINI_API_KEY`
   - Value：你的 Gemini API Key
3. 儲存後 Redeploy

### Step 4：完成
打開 Vercel 網址即可使用，完全免費。

## 注意事項
- Gemini 免費方案有速率限制（每分鐘 15 次請求），個人使用完全夠用
- AI 分析為估計值，不構成投資建議
- Yahoo Finance 為非官方 API
