# TripSplit

一個以 **Next.js + Prisma + PostgreSQL** 打造的旅遊分帳應用，專門用來管理多人旅程中的費用、分帳、結算、備份與通知流程。

> [!NOTE]
> 目前程式碼中的預設語系為繁體中文，並已具備英文語系架構與文案。

## 目錄

- [專案特色](#專案特色)
- [目前已具備的功能](#目前已具備的功能)
- [技術架構](#技術架構)
- [快速開始](#快速開始)
- [環境變數說明](#環境變數說明)
- [使用流程](#使用流程)
- [認證機制](#認證機制)
- [資料與檔案說明](#資料與檔案說明)
- [主要頁面與 API](#主要頁面與-api)
- [部署說明](#部署說明)
- [目前限制與注意事項](#目前限制與注意事項)

## 專案特色

- 以旅程為單位管理多人共同花費
- 支援邀請碼加入旅程與成員權限控管
- 支援多種分帳方式與多幣別記帳
- 內建自動結算建議與付款狀態追蹤
- 可匯出 JSON、CSV、PDF、圖片與文字版結算摘要
- 具備站內通知、通知偏好、活動紀錄與備份還原流程

## 目前已具備的功能

### 1. 帳號與身份識別

- 整合 LINE Login (LIFF + Web OAuth)
- 首次登入自動建立帳號
- 使用資料庫 session 與 cookie 維持登入狀態
- 旅程、成員、費用與付款紀錄都會綁定到使用者身份

### 2. 旅程管理

- 建立新旅程
- 設定旅程名稱、目的地、簡述、日期、主要幣別與封面 emoji
- 建立旅程時可一併加入其他旅伴
- 旅程建立者可修改或刪除旅程
- 提供邀請碼，讓其他使用者加入旅程

### 3. 成員與權限控管

- 旅程建立者可新增與移除成員
- 加入旅程時會嘗試認領同名成員，避免重複建立身份
- API 端有 owner / member 權限檢查
- UI 會依照權限顯示可執行操作

### 4. 消費記帳

- 新增、編輯、刪除費用
- 記錄金額、幣別、匯率、日期、說明、備註、付款人
- 支援收據圖片上傳（儲存於 Cloudflare R2）
- 支援以下分帳方式：
  - 平均分攤
  - 按比例分攤
  - 自訂金額分攤
  - 付款人自付
- 支援搜尋與篩選：
  - 關鍵字
  - 類別
  - 付款人
  - 日期區間

### 5. 多幣別與匯率換算

- 可為每筆費用指定幣別
- 當費用幣別與旅程基準幣別不同時，會查詢匯率
- 匯率 API 有快取與 fallback 邏輯，避免外部服務失敗時完全無法使用
- 已支援多個常見旅遊幣別，例如 TWD、USD、JPY、KRW、EUR、GBP、SGD 等

### 6. 收據上傳

- 可上傳圖片格式收據
- 檔案大小限制為 10MB
- 使用 Cloudflare R2 雲端物件儲存
- 上傳後可在費用項目中查看收據

### 7. 自動結算與付款紀錄

- 依據所有費用與分攤結果，自動產生待付款結算建議
- 提供「依付款關係」與「依人查看」兩種明細視角
- 可將建議款項標記為已付款
- 已付款紀錄會回寫到結算計算中
- 可撤銷或恢復付款狀態
- 支援付款備註

### 8. 特殊結算處理

- 正常納入結算
- 保留記帳，但不納入結算
- 已線下處理 / 私人支出
- 部分納入結算（百分比）

### 9. 類別管理

- 提供預設消費類別
- 旅程建立者可新增與刪除自訂類別
- 自訂類別可用於：
  - 記帳表單
  - 費用列表
  - 統計圖表
  - 匯出資料

### 10. 匯出、備份與還原

- 匯出結算文字摘要 `.txt`
- 匯出旅程備份 `.json`
- 匯出費用清單 `.csv`
- 匯出結算 PDF
- 匯出結算圖片
- 旅程擁有者可手動觸發備份，備份檔儲存於 Cloudflare R2
- 可從 JSON 備份匯入並建立「已還原」的新旅程

### 11. 統計與總結

- 旅程總支出
- 待結算筆數
- 納入結算與特殊處理費用統計
- 類別分佈
- 每日花費趨勢
- 旅程亮點摘要：
  - 支付最多的人
  - 最大單筆消費
  - 最高支出日
  - 最大消費類別

### 12. 通知與活動紀錄

- 首頁通知中心
- 最近 50 筆通知
- 可標記通知為已讀
- 可調整通知偏好
- 會對以下事件產生通知：
  - 新增 / 更新 / 刪除費用
  - 新增 / 移除成員
  - 標記 / 更新付款狀態
  - 匯出備份
  - 匯入備份
- 提供旅程活動紀錄頁籤，追蹤主要操作行為

### 13. 多語系與行動裝置體驗

- 已建立 `zh-TW` 與 `en` 語系資源
- 語系偏好會儲存到 `localStorage`
- 已考慮手機底部 safe area 與行動版底部快速切換列
- 介面以行動裝置操作為優先考量

## 技術架構

### 前端

- Next.js 14
- React 18
- Tailwind CSS
- LIFF SDK

### 後端 / 資料層

- Next.js Route Handlers
- Prisma ORM
- Supabase Postgres (PostgreSQL)
- Cloudflare R2 (物件儲存)
- Zod 驗證

### 其他能力

- LINE Login: 身份認證
- `html2canvas`：匯出結算圖片
- `jsPDF`：匯出結算 PDF
- Vercel Cron: 定時結算提醒與任務

## 快速開始

### 環境需求

- Node.js
- npm

### 1. 安裝依賴

```bash
git clone https://github.com/your-repo/TripSplit.git
cd TripSplit
npm install
```

### 2. 設定環境變數

請在專案根目錄建立 `.env`，或從 `.env.example` 複製。詳細設定方式請參考 `docs/setup/phase-0-external-provisioning.md`。

```bash
cp .env.example .env
```

### 3. 初始化資料庫

```bash
npm run db:generate
npm run db:migrate:dev
```

### 4. 啟動開發環境

```bash
npm run dev
```

## 環境變數說明

```env
# App
APP_URL=https://your-app.vercel.app
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

# Database (Supabase)
# 使用 Connection Pooling
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
# 用於 Migration 的直接連線
DATABASE_DIRECT_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres

# LINE Messaging API
LINE_CHANNEL_SECRET=your-channel-secret
LINE_CHANNEL_ACCESS_TOKEN=your-channel-access-token

# LINE Login (Web OAuth)
LINE_LOGIN_CHANNEL_ID=your-login-channel-id
LINE_LOGIN_CHANNEL_SECRET=your-login-channel-secret
LINE_LOGIN_REDIRECT_URI=https://your-app.vercel.app/api/auth/line/oauth/callback

# LIFF
LIFF_CHANNEL_ID=your-liff-channel-id
NEXT_PUBLIC_LIFF_ID=your-liff-id

# Cloudflare R2
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_BUCKET=tripsplit-uploads
R2_PUBLIC_URL=https://pub-xxx.r2.dev

# Cron
CRON_SECRET=your-random-secret
```

## 使用流程

1. 透過 LINE LIFF 或 Web 登入
2. 建立一趟旅程，設定旅程資訊與旅伴
3. 使用邀請碼讓其他成員加入
4. 在旅程中持續記錄每筆花費
5. 選擇分帳方式、幣別、匯率與是否納入結算
6. 到「結算」頁查看建議轉帳結果
7. 完成付款後標記為已付款
8. 在需要時匯出報表、建立備份或從 JSON 還原

## 認證機制

本專案整合 LINE 認證體系：
- **LINE App 內 (LIFF)**: 透過 LIFF SDK 自動登入。
- **外部瀏覽器 (Web OAuth)**: 經由 `/api/auth/line/oauth/start` 觸發 LINE Login 流程。

## 資料與檔案說明

### 重要目錄

- `src/app/`：頁面與 API route
- `src/lib/`：auth、settlement、notifications、validation、i18n 等核心邏輯
- `prisma/schema.prisma`：資料模型與資料庫設定
- `docs/setup/`：外部服務開通指引與設定文件

### 主要資料模型

- `User`
- `Session`
- `Trip`
- `Member`
- `Expense`
- `Split`
- `SettlementPayment`
- `ActivityLog`
- `Notification`
- `NotificationPreference`
- `CustomCategory`
- `BackupRecord`

## 主要頁面與 API

### 頁面

- `/`：首頁、旅程列表、通知中心、匯入備份、通知偏好
- `/login`：登入頁
- `/trips/new`：建立旅程
- `/trips/[tripId]`：旅程詳情、記帳、結算、統計、總結、活動紀錄

### API 類型

- `/api/auth/*`：LINE Login (LIFF & OAuth) 相關介面
- `/api/trips`：旅程列表與建立旅程
- `/api/trips/join`：邀請碼加入旅程
- `/api/trips/import`：匯入備份
- `/api/trips/[tripId]/*`：旅程內容、成員、費用、付款、類別、備份、活動紀錄
- `/api/notifications/*`：通知與通知偏好
- `/api/upload`：收據上傳至 R2
- `/api/exchange-rate`：匯率查詢

## 部署說明

本專案建議部署於 **Vercel**：
1. 在 Vercel Dashboard 設定上述所有環境變數。
2. 專案包含 `vercel.json`，已預設配置每日 09:00 UTC 的結算提醒 Cron Job。
3. 建議將 Vercel 部署區域設定在與 Supabase 資料庫相同的區域（例如新加坡 `sin1`）以獲得最佳效能。

## 目前限制與注意事項

> [!WARNING]
> README 內容以目前程式碼實作為準。

- 認證目前全面切換為 LINE Login，不再支援傳統 Email 登入。
- 資料庫使用 Supabase (Postgres)；部署前請確保已完成 Schema Migration。
- 收據檔案與備份均儲存於 Cloudflare R2，不佔用伺服器本機空間。
- 專案已整合 Vercel Cron，定時任務需在 Vercel 環境中方可完整運作。

## 專案腳本

```json
{
  "dev": "next dev",
  "dev:lan": "next dev -H 0.0.0.0",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "db:generate": "prisma generate",
  "db:migrate:dev": "prisma migrate dev",
  "db:migrate:deploy": "prisma migrate deploy",
  "db:migrate:status": "prisma migrate status"
}
```

## 適合的使用情境

- 家庭旅遊共同記帳
- 朋友出國分帳
- 小型團體旅程費用整理
- 行程結束後產出結算與統計摘要
