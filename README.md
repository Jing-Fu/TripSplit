# TripSplit

一個以 **Next.js + Prisma + SQLite** 打造的旅遊分帳應用，專門用來管理多人旅程中的費用、分帳、結算、備份與通知流程。

> [!NOTE]
> 目前程式碼中的預設語系為繁體中文，並已具備英文語系架構與文案。

## 目錄

- [專案特色](#專案特色)
- [目前已具備的功能](#目前已具備的功能)
- [技術架構](#技術架構)
- [快速開始](#快速開始)
- [使用流程](#使用流程)
- [資料與檔案說明](#資料與檔案說明)
- [主要頁面與 API](#主要頁面與-api)
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

- 使用 Email + 顯示名稱登入
- 首次登入可直接建立帳號
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
- 支援收據圖片上傳
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
- 目前會將檔案寫入 `public/uploads`
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
- 旅程擁有者可建立伺服器端備份
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

### 後端 / 資料層

- Next.js Route Handlers
- Prisma ORM
- SQLite
- Zod 驗證

### 其他能力

- `html2canvas`：匯出結算圖片
- `jsPDF`：匯出結算 PDF
- `nanoid` / `uuid`：產生 session token 與檔名

## 快速開始

### 環境需求

- Node.js
- npm

本專案有 `package-lock.json`，建議直接使用 `npm`。

### 1. 安裝依賴

```bash
npm install
```

### 2. 環境變數

請在專案根目錄建立 `.env`，或直接從 `.env.example` 複製：

```bash
cp .env.example .env
```

目前預設：

```env
DATABASE_URL="file:./prisma/dev.db"
APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
NEXT_PUBLIC_GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
```

- `GOOGLE_CLIENT_ID`：後端驗證 Google ID token 使用
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`：前端載入 Google Sign-In 按鈕使用
- `APP_URL` / `NEXT_PUBLIC_APP_URL`：登入 redirect mode 與前端頁面顯示使用，開發時預設為 `http://localhost:3000`

若要用 **手機或同網段裝置** 測試，請改用區網網址，例如：

```env
APP_URL="http://192.168.1.10:3000"
NEXT_PUBLIC_APP_URL="http://192.168.1.10:3000"
```

並在 Google Cloud Console 的這組 OAuth Web client 補上：

- **Authorized JavaScript origins**
  - `http://localhost`
  - `http://localhost:3000`
  - `http://192.168.1.10:3000`（請換成你的實際 LAN 位址）
- **Authorized redirect URIs**
  - `http://localhost:3000/api/auth/login`
  - `http://192.168.1.10:3000/api/auth/login`（手機/LAN 測試需要）

若要啟用 **Notion 匯出**，請另外加入：

```env
NOTION_TOKEN="secret_xxx"
NOTION_PARENT_PAGE_ID="your_notion_page_id"
```

- `NOTION_TOKEN`：Notion integration 的 internal token
- `NOTION_PARENT_PAGE_ID`：作為匯出父層的 Notion 頁面 ID，TripSplit 會在這個頁面下建立旅程子頁
- 請把這兩個值保留在 server 端環境變數，不要使用 `NEXT_PUBLIC_` 前綴

> [!IMPORTANT]
> Prisma schema 使用 SQLite，預設資料庫檔案會落在 `prisma/dev.db`。

### 3. 初始化 Prisma 資料庫

第一次啟動前，請先產生 Prisma Client 並建立 SQLite 資料庫 schema：

```bash
npx prisma generate
npx prisma db push
```

成功後會建立 `prisma/dev.db`，登入功能才會正常使用。

### 4. 啟動開發環境

```bash
npm run dev
```

> [!TIP]
> 不要使用 `npx run dev`。那會嘗試執行名為 `dev` 的 Node 模組，因此出現 `Cannot find module '/.../dev'`。

若要讓手機透過同網段連入，請使用：

```bash
npm run dev:lan
```

### 5. 建置正式版本

```bash
npm run build
```

### 6. 啟動正式模式

```bash
npm run start
```

### 7. 執行程式碼檢查

```bash
npm run lint
```

## 使用流程

1. 先登入或建立帳號
2. 建立一趟旅程，設定旅程資訊與旅伴
3. 使用邀請碼讓其他成員加入
4. 在旅程中持續記錄每筆花費
5. 選擇分帳方式、幣別、匯率與是否納入結算
6. 到「結算」頁查看建議轉帳結果
7. 完成付款後標記為已付款
8. 在需要時匯出報表、建立備份或從 JSON 還原

## 資料與檔案說明

### 重要目錄

- `src/app/`：頁面與 API route
- `src/lib/`：auth、settlement、notifications、validation、i18n 等核心邏輯
- `prisma/schema.prisma`：資料模型與資料庫設定
- `public/uploads/`：收據圖片上傳位置
- `public/backups/`：伺服器端備份輸出位置

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

- `/api/auth/*`：登入、登出、session
- `/api/trips`：旅程列表與建立旅程
- `/api/trips/join`：邀請碼加入旅程
- `/api/trips/import`：匯入備份
- `/api/trips/[tripId]/*`：旅程內容、成員、費用、付款、類別、備份、活動紀錄
- `/api/notifications/*`：通知與通知偏好
- `/api/upload`：收據上傳
- `/api/exchange-rate`：匯率查詢

## 目前限制與注意事項

> [!WARNING]
> README 內容以目前程式碼實作為準，而不是規劃文件或待辦清單。

- 認證目前為簡易 Email + 顯示名稱登入，尚未整合 OAuth 或密碼機制
- 資料庫目前使用 SQLite，適合本機開發與小型部署
- 專案目前沒有定義 Docker、CI/CD 或雲端部署設定檔
- 專案沒有提供 Prisma migration scripts；目前可見的是既有 schema 與 SQLite 資料庫檔案
- 收據檔案目前儲存在本機檔案系統，而非雲端物件儲存
- 程式中已建立 i18n 架構，但目前未見完整的語系切換 UI
- 規劃文件中提到的部分未來功能，若未出現在目前程式碼中，並不代表已完成

## 專案腳本

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint"
}
```

## 適合的使用情境

- 家庭旅遊共同記帳
- 朋友出國分帳
- 小型團體旅程費用整理
- 行程結束後產出結算與統計摘要

如果你想繼續擴充這個專案，下一步很適合補上的方向會是：更完整的部署流程、雲端檔案儲存、正式認證機制，以及更完整的語系切換體驗。
