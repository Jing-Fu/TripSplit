# TripSplit

一個自架的旅遊支出追蹤與分帳 Web App，專為多人旅行設計。旅途中隨時記帳、支援多幣別與即時匯率，旅程結束後自動計算最佳結算方案。

## 功能概覽

**費用記錄**
- 新增、編輯、刪除費用，支援類別、備註與收據照片
- 多幣別支援，自動查詢即時匯率
- 每趟旅程可自訂消費類別
- 支援關鍵字、類別、付款人、日期區間篩選

**彈性分帳**
- 均分、付款人自付、按比例、自訂金額四種分帳方式
- 可將費用標記為排除結算、線下處理或部分結算

**結算**
- 最少轉帳次數結算演算法
- 依人查看明細——清楚呈現每位成員的待付與待收
- 可標記付款完成、加上備註，支援撤銷
- 匯出格式：TXT、CSV、JSON、PDF、圖片

**多人協作**
- 透過唯一邀請碼邀請旅伴加入
- 旅程建立者管理成員與自訂類別
- 站內通知中心，每位使用者可獨立設定通知偏好
- 完整的旅程操作活動紀錄

**備份與還原**
- 從瀏覽器匯出 JSON 備份，或由旅程擁有者觸發伺服器端備份
- 可將任何 JSON 備份匯入為新的還原旅程

**多語系**
- 支援繁體中文（zh-TW）與英文（en）
- 使用 `LocaleProvider` + 型別安全的 `t()` 函式，偏好儲存於 `localStorage`

## 技術棧

| 層級 | 技術 |
|---|---|
| 框架 | Next.js 14（App Router） |
| 語言 | TypeScript |
| 樣式 | Tailwind CSS |
| 資料庫 | SQLite（透過 Prisma ORM） |
| 驗證 | Zod |
| 圖表 | Recharts |
| 匯出 | jsPDF + html2canvas |
| 日期處理 | date-fns |

## 開始使用

### 環境需求

- Node.js 18+

### 安裝步驟

1. 安裝依賴套件：
   ```bash
   npm install
   ```

2. 建立 `.env` 檔案：
   ```env
   DATABASE_URL="file:./dev.db"
   ```

3. 初始化資料庫：
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. 啟動開發伺服器：
   ```bash
   npm run dev
   ```

5. 開啟 [http://localhost:3000](http://localhost:3000)，並前往 `/login` 登入。

> [!NOTE]
> 第一次造訪 `/login` 時，輸入任意 Email 與顯示名稱，系統會自動建立帳號。

## 專案結構

```
src/
├── app/
│   ├── api/                # API 路由（auth、trips、expenses、members、
│   │   │                   #   payments、notifications、upload、exchange-rate）
│   ├── trips/[tripId]/     # 旅程詳情頁（消費、結算、統計、總結）
│   ├── trips/new/          # 建立新旅程
│   ├── login/              # 登入頁
│   └── page.tsx            # 首頁——旅程列表、通知中心、備份匯入
├── lib/
│   ├── settlement.ts       # 結算計算邏輯
│   ├── validations.ts      # 所有 API 輸入的 Zod schemas
│   ├── fetch.ts            # 集中化 safeFetch 與錯誤處理
│   ├── notifications.ts    # 通知建立（依偏好過濾）
│   ├── i18n/               # LocaleProvider、useLocale()、zh-TW 與 en 字典
│   └── constants.ts        # 預設消費類別、幣別、分帳方式
└── prisma/
    └── schema.prisma       # 資料模型定義
```

## 資料模型

| 模型 | 用途 |
|---|---|
| `Trip` | 旅程，含幣別、邀請碼與擁有者 |
| `Member` | 旅程成員，可選擇性綁定 `User` |
| `Expense` | 費用，含分帳明細、結算模式與收據 |
| `Split` | 每位成員的費用分攤金額 |
| `SettlementPayment` | 成員間已記錄的付款紀錄 |
| `ActivityLog` | 旅程所有操作的不可變稽核紀錄 |
| `Notification` | 站內通知，依 `NotificationPreference` 過濾 |
| `CustomCategory` | 旅程專屬的使用者自訂消費類別 |
| `BackupRecord` | 伺服器端備份檔案的元資料 |

## 開發指令

```bash
npm run dev          # 啟動開發環境
npm run build        # 正式版本編譯
npm run start        # 執行編譯後的正式版本
npm run lint         # ESLint 檢查
npx prisma studio    # 開啟資料庫視覺化介面
```

## 已知限制

- 使用 SQLite，不適合多實例部署（需共享檔案系統）。
- 目前僅支援站內通知，尚未實作 Email 或 Push 通知。
- 備份需手動觸發，尚未提供自動排程備份。
