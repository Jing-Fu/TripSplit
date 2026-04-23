# TripSplit - 旅遊分帳工具

TripSplit 是一個專為旅伴設計的旅遊支出追蹤與分帳 Web App。讓你在旅途中輕鬆記錄每一筆消費，自動計算匯率，並在旅程結束時提供最佳的結算方案。

## 核心功能

- **旅程管理**：建立新旅程，設定目的地、日期及基礎幣別。
- **邀請與加入**：透過唯一的邀請碼，讓旅伴快速加入同一趟旅程。
- **多幣別記帳**：支援多種外幣記錄，自動查詢並轉換為旅程基礎幣別匯率。
- **彈性分帳**：支援均分、由付款人承擔、按比例或具體金額分帳。
- **收據上傳**：可拍照或上傳收據照片，方便日後核對。
- **自動結算**：一鍵計算所有成員間的欠款關係，提供最少轉帳次數的結算建議。
- **統計分析**：直觀的消費類別圓餅圖與每日支出趨勢圖。

## 技術棧

- **框架**：[Next.js 14 (App Router)](https://nextjs.org/)
- **語言**：TypeScript
- **樣式**：Tailwind CSS
- **資料庫**：SQLite (透過 Prisma ORM)
- **圖表**：Recharts
- **日期處理**：date-fns

## 開始使用

### 環境需求

- Node.js 18+

### 安裝步驟

1. 安裝依賴套件：
   ```bash
   npm install
   ```

2. 設定環境變數：
   建立一個 `.env` 檔案並設定資料庫路徑：
   ```env
   DATABASE_URL="file:./dev.db"
   ```

3. 初始化資料庫（Prisma）：
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. 啟動開發伺服器：
   ```bash
   npm run dev
   ```

5. 開啟瀏覽器並造訪 `http://localhost:3000`。

## 專案結構

- `src/app`: Next.js App Router 路由與頁面
- `src/app/api`: API 路由（包含匯率查詢、檔案上傳、旅程與消費 CRUD）
- `src/components`: UI 元件
- `src/lib`: 工具函式與常數設定
- `prisma`: 資料庫模型定義與遷移檔案
- `public`: 靜態檔案儲存處

## 開發指令

- `npm run dev`: 啟動開發環境
- `npm run build`: 編譯正式版本
- `npm run start`: 執行編譯後的正式版本
- `npm run lint`: 執行 ESLint 檢查
- `npx prisma studio`: 開啟 Prisma 資料庫視覺化管理介面

## 授權

此專案僅供學術與練習使用。
