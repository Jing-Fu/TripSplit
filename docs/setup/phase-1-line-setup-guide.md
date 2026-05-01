# Phase 1 — TripSplit 完整部署教學

> **適用對象**：第一次部署 TripSplit 的人，沒做過 LINE Developers / Supabase / Vercel 也沒關係。
> **預估時間**：第一次跑完約 90–120 分鐘（含等服務開通）。
> **前置條件**：
>
> - 一個你會用的 LINE 個人帳號（用來登入 Console、收驗證）
> - 一個 GitHub 帳號（你的程式碼已經 push 到 GitHub）

---

## 0. 整體藍圖

整套服務由 **5 個外部平台** 組合而成，先看完一遍再動手，會比較有方向感：

```
┌──────────────────────────────────────────────────────────────┐
│                     TripSplit 部署架構                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   使用者瀏覽器 ──────────────────► Vercel (Next.js 應用)      │
│        │                              │                      │
│        │                              ├─► Supabase           │
│        │                              │   (資料庫、Storage)   │
│        │                              └─► LINE Messaging API │
│        │                                  (推播訊息)          │
│        │                                                     │
│        └─── 透過 LINE Login / LIFF 登入 ───► LINE Platform   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

| 階段       | 平台             | 你會拿到什麼                              | 大約耗時 |
| ---------- | ---------------- | ----------------------------------------- | -------- |
| **階段 A** | LINE Developers  | Provider + 3 個 Channel                   | 30 分鐘  |
| **階段 B** | Supabase         | PostgreSQL 資料庫 + Storage bucket + 金鑰 | 15 分鐘  |
| **階段 C** | Supabase Storage | 確認 bucket 與 server-side 金鑰           | 5 分鐘   |
| **階段 D** | Vercel           | 線上正式網址                              | 15 分鐘  |
| **階段 E** | 回填設定         | 把所有網址回填回 LINE/Vercel              | 15 分鐘  |
| **階段 F** | 驗證             | 確認登入、推播、上傳都正常                | 15 分鐘  |

> 💡 **小提醒**：階段 A 跟階段 B/C/D 是**獨立的**，可以平行進行。
> 但階段 E（回填設定）一定要等所有東西都建好。

---

# 階段 A：LINE Developers 設定

> 你會在這個階段建立：
>
> - **1 個 Provider**
> - **1 個 LINE Login Channel**（給外部瀏覽器登入用）
> - **1 個 LIFF App**（掛在 LINE Login Channel 底下，給 LINE App 內部使用）
> - **1 個 LINE Official Account → Messaging API Channel**（推播通知用）

---

## A-1. 註冊 / 登入 LINE Developers

1. 前往 👉 https://developers.line.biz/console/
2. 點 **「Log in with LINE Account」**
3. 用手機掃 QR code 或輸入 LINE Email/密碼登入
4. 第一次登入會要求填 **Developer 資料**：
   - **Developer name**：你的名字或暱稱（例：`Fujing`）
   - **Email**：用於收 LINE 平台通知
   - 同意條款 → **Register**

✅ **完成檢查點**：你會看到 Console 主頁，畫面中央有 **「Create a new provider」** 按鈕。

---

## A-2. 建立 Provider

> Provider = 「組織/品牌」的概念，所有 Channel 都掛在它底下。
> ⚠️ **一旦建立，Channel 不能搬到別的 Provider，所以名字想好再建**。

1. 在 Console 主頁，點 **「Create a new provider」**
2. **Provider name**：`TripSplit`（或你自己的品牌名）
3. 點 **Create**

✅ **完成檢查點**：你會進到 Provider 頁面，看到 3 個 tab：

- **Channels**（目前是空的）
- **Roles**
- **Settings**

---

## A-3. 建立 LINE Login Channel（外部瀏覽器登入用）

1. 在 Provider 頁面的 **Channels** tab，點 **「Create a LINE Login channel」**
   （如果看不到，點右上角 **「Create a new channel」** → 選 **LINE Login**）
2. 填寫表單：

   | 欄位                                  | 填什麼                         | 備註                      |
   | ------------------------------------- | ------------------------------ | ------------------------- |
   | **Channel type**                      | `LINE Login`                   | 應該已預選                |
   | **Provider**                          | 你剛建的 Provider              | 已預選                    |
   | **Region to provide the service**     | `Taiwan`                       | 一旦選定無法修改          |
   | **Company or owner's country/region** | `Taiwan`                       |                           |
   | **Channel icon**                      | 選填                           | 可上傳 app logo           |
   | **Channel name**                      | `TripSplit Login`              | ⚠️ **不能含 "LINE" 字樣** |
   | **Channel description**               | `旅遊分帳應用的 LINE 登入服務` |                           |
   | **App types**                         | ✅ **勾 Web app**（必勾）      | 一定要勾                  |
   | **Email address**                     | 你的 Email                     |                           |
   | **Privacy policy URL**                | 留白                           | 之後上線再補              |
   | **Terms of use URL**                  | 留白                           |                           |

3. 勾選 **LINE Developers Agreement** → **Create**

✅ **完成檢查點**：你會進到 Channel 頁面，最上面有 **Channel ID** 和切換按鈕 `Developing`。

### 🔑 立刻記下這兩個值（之後填 `.env` 用）

到 **Basic settings** tab，找到並抄下來：

```
LINE_LOGIN_CHANNEL_ID    = (Channel ID 那一欄的數字)
LINE_LOGIN_CHANNEL_SECRET = (Channel secret 那一欄，按 Issue 才會出現)
```

> 💡 把這些值貼到一個暫存的記事本裡，後面會一起填。

---

## A-4. 建立 LIFF App（LINE App 內部開啟用）

> LIFF 不是獨立 channel，它是**掛在 LINE Login Channel 底下**的 app。

1. **同一個 LINE Login Channel** 內，點 **「LIFF」** tab
2. 點 **「Add」** 按鈕
3. 填寫表單：

   | 欄位                  | 填什麼                                                                |
   | --------------------- | --------------------------------------------------------------------- |
   | **LIFF app name**     | `TripSplit`                                                           |
   | **Size**              | ✅ **Full**（全螢幕）                                                 |
   | **Endpoint URL**      | `https://example.vercel.app`（先暫填，等階段 D 拿到正式網址再回來改） |
   | **Scopes**            | ✅ 勾 **`profile`** + ✅ 勾 **`openid`**                              |
   | **Add friend option** | `Off`                                                                 |
   | **Scan QR**           | Off                                                                   |
   | **Module mode**       | Off                                                                   |

4. 點 **Add**

✅ **完成檢查點**：LIFF tab 列表會出現一筆新項目，點進去可以看到：

- **LIFF ID**（格式：`1234567890-AbcdEfgh`）
- **LIFF URL**（格式：`https://liff.line.me/1234567890-AbcdEfgh`）

### 🔑 立刻記下這些值

```
LIFF_ID              = (LIFF ID，例：1234567890-AbcdEfgh)
NEXT_PUBLIC_LIFF_ID  = (跟 LIFF_ID 同一個值)
LIFF_CHANNEL_ID      = (用 LINE_LOGIN_CHANNEL_ID 同一個值，因為 LIFF 掛在這個 channel 底下)
```

> ⚠️ 注意：`LIFF_CHANNEL_ID` 和 `LINE_LOGIN_CHANNEL_ID` 是**同一個值**。
> 程式用它來驗證 LIFF ID Token 的 audience。

---

## A-5. 建立 LINE Official Account + Messaging API Channel（推播用）

> ⚠️ **重要更新（2024 年 9 月後）**：LINE 已不再允許從 Developers Console 直接建 Messaging API Channel。
> 必須先建一個 LINE Official Account，再啟用它的 Messaging API。

### A-5-1. 註冊 Business ID

1. 前往 👉 https://account.line.biz/signup
2. 選擇用 **LINE 帳號註冊**（最快），或用 Email
3. 完成驗證

### A-5-2. 建立 LINE Official Account

1. 註冊完會自動跳到 entry form：https://entry.line.biz/form/entry/unverified
2. 填寫表單：

   | 欄位                      | 填什麼                        |
   | ------------------------- | ----------------------------- |
   | **Account name**          | `TripSplit`（會顯示給用戶看） |
   | **Email**                 | 你的 Email                    |
   | **Country/Region**        | `Taiwan`                      |
   | **Company name**          | 個人填自己名字                |
   | **Business category**     | `IT/通訊 → 軟體`              |
   | **Business sub-category** | 隨便選一個合理的              |

3. 送出 → 會自動建立 OA

### A-5-3. 啟用 Messaging API

1. 前往 👉 https://manager.line.biz/
2. 選你剛建的 OA（`TripSplit`）
3. 右上角點 ⚙️ **設定 (Settings)** → 左側選 **Messaging API**
4. 點 **「啟用 Messaging API」**
5. 跳出對話框，**Provider**：選你剛建的 `TripSplit` Provider
   - ⚠️ **一定要選同一個 Provider**，否則 user ID 會不一致
6. 確認 → 完成

### A-5-4. 取得 Messaging API 設定值

1. 回到 https://developers.line.biz/console/
2. 點進 `TripSplit` Provider，會看到一個**新的 Channel** 出現（名字跟 OA 一樣）
3. 點進去，到 **Basic settings** tab：

   ```
   LINE_CHANNEL_ID     = (Channel ID)
   LINE_CHANNEL_SECRET = (Channel secret)
   ```

4. 切換到 **Messaging API** tab：
   - 找到 **Channel access token (long-lived)**
   - 點 **Issue** → 會生成一段長字串
   - 複製下來：

   ```
   LINE_CHANNEL_ACCESS_TOKEN = (剛 issue 的 long-lived token)
   ```

### A-5-5. 關掉 OA 的自動回應（避免和 webhook 衝突）

1. 回到 https://manager.line.biz/ → 你的 OA → 設定 → **回應設定**
2. **回應模式**：選 **「聊天機器人」**（不是「聊天」）
3. **Webhook**：✅ **開啟**
4. **自動回應訊息**：❌ **關閉**
5. **加入好友的歡迎訊息**：可以保留也可以關（看你需求）

> Webhook URL 等階段 E 才會回來填。

✅ **階段 A 完成檢查點**：你的暫存記事本應該有以下 8 個值：

```
LINE_LOGIN_CHANNEL_ID
LINE_LOGIN_CHANNEL_SECRET
LIFF_ID
NEXT_PUBLIC_LIFF_ID
LIFF_CHANNEL_ID  (= LINE_LOGIN_CHANNEL_ID)
LINE_CHANNEL_ID
LINE_CHANNEL_SECRET
LINE_CHANNEL_ACCESS_TOKEN
```

---

# 階段 B：Supabase 資料庫與 Storage

> 你會在這個階段建立：
>
> - **1 個 Supabase Project**（含 PostgreSQL 資料庫）
> - **2 種連線字串**（pooled + direct）
> - **1 個 private Storage bucket**（存收據圖、備份檔）
> - **1 組 server-side Storage 金鑰**

---

## B-1. 建立 Supabase 帳號 + Project

1. 前往 👉 https://supabase.com/dashboard
2. 用 **GitHub** 登入（最快）
3. 進到 Dashboard，點 **「New project」**
4. 填寫：

   | 欄位                  | 填什麼                                                   |
   | --------------------- | -------------------------------------------------------- |
   | **Organization**      | 選預設或建一個新的                                       |
   | **Project name**      | `tripsplit`                                              |
   | **Database Password** | ⚠️ **點「Generate a password」自動生成，並立刻複製存好** |
   | **Region**            | ✅ **`Southeast Asia (Singapore)`** ← 為了和 Vercel 同區 |
   | **Pricing Plan**      | `Free`                                                   |

5. 點 **「Create new project」**，等待 1–2 分鐘初始化

> 🔑 **資料庫密碼只會顯示一次！**
> 如果忘了，要去 Settings → Database → **Reset database password** 重設。

✅ **完成檢查點**：你看到 Supabase 主控台，左側有 Table Editor、SQL Editor 等選項。

---

## B-2. 取得連線字串

1. Project 頁面右上角點 **「Connect」** 按鈕
2. 在彈出視窗中找 **「ORMs」** tab → 選 **「Prisma」**

   或是手動到 Settings → Database → Connection string

3. 你會看到兩種連線：

   ### 📌 Transaction pooler（給 app 用，port 6543）

   ```
   postgresql://postgres.xxxxxxxxxxx:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
   ```

   把 `[YOUR-PASSWORD]` 換成你 B-1 存的密碼。
   → 這就是 `DATABASE_URL`

   ### 📌 Session pooler / Direct（給 migration 用，port 5432）

   ```
   postgresql://postgres.xxxxxxxxxxx:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
   ```

   把 `[YOUR-PASSWORD]` 換成你 B-1 存的密碼。
   → 這就是 `DATABASE_DIRECT_URL`

> 💡 **為什麼要兩個？**
>
> - `DATABASE_URL`（6543 + pgbouncer）：給應用程式跑 query 用，serverless 友善。
> - `DATABASE_DIRECT_URL`（5432）：給 `prisma migrate` 用，因為 pgbouncer 不支援 DDL transaction。

### 🔑 立刻記下

```
DATABASE_URL         = postgresql://...:6543/postgres?pgbouncer=true&connection_limit=1
DATABASE_DIRECT_URL  = postgresql://...:5432/postgres
```

---

# 階段 C：Supabase Storage 物件儲存

> 你會在這個階段建立：
>
> - **1 個 private bucket**（存收據圖、備份檔）
> - **Project URL** 與 **secret key**（只給 Vercel server-side 使用）

> ⚠️ **注意**：`SUPABASE_SECRET_KEY` 權限很高，只能放在 Vercel Environment Variables，不能加 `NEXT_PUBLIC_`，也不能放到前端程式。

---

## C-1. 建立 Storage bucket

1. 在 Supabase Dashboard 左側點 **Storage**
2. 點 **「New bucket」**
3. 填寫：

   | 欄位              | 填什麼                |
   | ----------------- | --------------------- |
   | **Bucket name**   | `trip-files`          |
   | **Public bucket** | ❌ 關閉，保持 private |

4. 點 **「Create bucket」**

---

## C-2. 取得 Project URL 與 secret key

1. 到 Supabase Dashboard → **Project Settings** → **API Keys**
2. 複製 **Project URL**
3. 複製 **Secret key**

> `anon public` / `publishable` key 不能取代 secret key，因為上傳、刪除與產生 private signed URL 都在 server-side 執行。
> 若你看到的是舊版介面，也可以用 legacy `service_role` key；程式碼仍相容，但新設定建議統一改用 `SUPABASE_SECRET_KEY`。

✅ **階段 C 完成檢查點**：暫存記事本應該有：

```
SUPABASE_URL
SUPABASE_SECRET_KEY=""
STORAGE_PROVIDER = supabase
STORAGE_BUCKET   = trip-files
```

---

# 階段 D：Vercel 部署

> 你會在這個階段：
>
> - 把 GitHub repo 連到 Vercel
> - 設定環境變數
> - 部署到 sin1（新加坡）區
> - 拿到正式網址

---

## D-1. 註冊 / 登入 Vercel

1. 前往 👉 https://vercel.com/signup
2. 用 **GitHub** 登入（最快），授權 Vercel 存取你的 repo
3. 完成 onboarding（選 Hobby 免費方案即可）

---

## D-2. Import Project

1. Dashboard → 點 **「Add New...」** → **「Project」**
2. 在 **Import Git Repository** 列表找到 `TripSplit` repo
   - 找不到？點 **「Adjust GitHub App Permissions」** 把 repo 加到允許清單
3. 點 **Import**

---

## D-3. 設定 Build & Output

進到設定頁，**先不要按 Deploy**，要先設定：

| 欄位                 | 設定                                                     |
| -------------------- | -------------------------------------------------------- |
| **Framework Preset** | `Next.js`（自動偵測）                                    |
| **Root Directory**   | `./`（預設）                                             |
| **Build Command**    | `prisma generate && prisma migrate deploy && next build` |
| **Output Directory** | 留空（預設）                                             |
| **Install Command**  | `npm install`                                            |

> 💡 **為什麼 Build Command 要加 `prisma migrate deploy`？**
> 這樣每次部署都會自動套用 migration 到 Supabase，避免「程式更新但資料表沒更新」。

---

## D-4. 設定環境變數（先填能填的）

展開 **「Environment Variables」**，把以下值貼進去（**要勾選 Production / Preview / Development 三個環境**）：

### 已知值（從前面階段拿到的）

```
DATABASE_URL              = (B-2)
DATABASE_DIRECT_URL       = (B-2)
SUPABASE_URL              = (C-2)
SUPABASE_SERVICE_ROLE_KEY = (C-2)
STORAGE_PROVIDER          = supabase
STORAGE_BUCKET            = trip-files
LINE_LOGIN_CHANNEL_ID     = (A-3)
LINE_LOGIN_CHANNEL_SECRET = (A-3)
LIFF_ID                   = (A-4)
NEXT_PUBLIC_LIFF_ID       = (A-4)
LIFF_CHANNEL_ID           = (A-4，= LINE_LOGIN_CHANNEL_ID)
LINE_CHANNEL_ID           = (A-5)
LINE_CHANNEL_SECRET       = (A-5)
LINE_CHANNEL_ACCESS_TOKEN = (A-5)
```

### 自己生成的隨機字串

用 `openssl rand -base64 48` 或線上工具生兩段 32+ 字元的隨機字串：

```
SESSION_SECRET = (32 字元以上隨機字串)
CRON_SECRET    = (32 字元以上隨機字串)
```

### 暫時填佔位值（D-5 拿到正式網址後回來改）

```
APP_URL                  = https://placeholder.vercel.app
NEXT_PUBLIC_APP_URL      = https://placeholder.vercel.app
LINE_LOGIN_REDIRECT_URI  = https://placeholder.vercel.app/api/auth/line/oauth/callback
```

### Notion（可選，用不到就先不填）

```
NOTION_TOKEN            = (留空)
NOTION_PARENT_PAGE_ID   = (留空)
```

---

## D-5. 切換部署區域到新加坡

1. 在 **Project Settings** → **Functions** → **Function Region**
2. 選 **`Singapore (sin1)`**
3. 儲存

> 為什麼？Supabase 你選了新加坡區，Vercel 也用新加坡區的話，DB 查詢延遲會從 ~200ms 降到 ~5ms。

---

## D-6. 第一次部署

1. 回到 Project Overview → 點 **「Deploy」**
2. 等 build 跑完（通常 2–4 分鐘）

⚠️ **第一次部署很可能失敗**，因為 `LINE_LOGIN_REDIRECT_URI` 還是佔位值。沒關係，繼續。

3. **記下 Vercel 給你的網址**，格式類似：

```
https://tripsplit-xxxx-yourname.vercel.app
```

或者，如果你有自訂 domain：

```
https://tripsplit.com
```

→ 這就是接下來要回填的 **正式 APP URL**。

---

# 階段 E：回填所有設定

> 拿到正式網址後，要回去把所有「暫填」的網址改成正式的。

假設你拿到的網址是 `https://tripsplit.vercel.app`，下面所有 `<APP_URL>` 都換成這個。

---

## E-1. 更新 Vercel 環境變數

1. Vercel → Project → **Settings** → **Environment Variables**
2. 編輯這 3 個：

```
APP_URL                 = https://<APP_URL>
NEXT_PUBLIC_APP_URL     = https://<APP_URL>
LINE_LOGIN_REDIRECT_URI = https://<APP_URL>/api/auth/line/oauth/callback
```

3. **務必觸發重新部署**：Project → Deployments → 最上面那個 → 右側 ⋯ → **Redeploy**
   - ⚠️ 環境變數**不會自動套用到舊部署**，一定要 Redeploy。

---

## E-2. 更新 LINE Login Channel 的 Callback URL

1. https://developers.line.biz/console/ → 你的 Provider → **TripSplit Login** Channel
2. 切到 **「LINE Login」** tab
3. 找到 **Callback URL**，貼上：

```
https://<APP_URL>/api/auth/line/oauth/callback
```

4. 點 **Update**

---

## E-3. 更新 LIFF Endpoint URL

1. 同一個 LINE Login Channel → **「LIFF」** tab
2. 點你的 `TripSplit` LIFF app → **Edit**
3. **Endpoint URL** 改成：

```
https://<APP_URL>
```

> ⚠️ **不要加結尾斜線**，也不要加路徑。LIFF 進入後會自動導到首頁。

4. 點 **Update**

---

## E-4. 更新 Messaging API Webhook URL

1. https://developers.line.biz/console/ → 你的 Provider → **Messaging API Channel**
2. 切到 **「Messaging API」** tab
3. **Webhook URL** 貼上：

```
https://<APP_URL>/api/line/webhook
```

> ⚠️ **不要加結尾斜線**。請填 `.../webhook`，不要填成 `.../webhook/`，否則 LINE 驗證時可能收到 `308 Permanent Redirect`。

4. 點 **Update**
5. 點旁邊的 **Verify** 按鈕，應該回 `Success`
   - ❌ 失敗：表示 webhook endpoint 沒回應，請檢查 Vercel 部署是否成功
6. **Use webhook**：✅ **開啟**

---

## E-5. 更新 OA 加好友連結（可選）

如果想讓使用者加你的 OA 為好友才收得到推播：

1. https://manager.line.biz/ → 你的 OA → 首頁
2. 找到 **加好友連結 / QR code**
3. 複製連結放到你的 app 介紹頁

---

# 階段 F：驗證

> 全部設好之後，按順序驗證每一條路徑。

---

## F-1. 確認資料庫 schema 已建立

在你的本機跑：

```bash
# 把線上的 DATABASE_URL/DIRECT_URL 寫到本機 .env
npm run db:migrate:status
```

應該看到：`Database schema is up to date!`

如果沒有，手動推一次：

```bash
npm run db:migrate:deploy
```

---

## F-2. 在外部瀏覽器測試 LINE Login

1. 打開**手機或電腦的 Chrome / Safari**（**不要用 LINE App**）
2. 訪問 `https://<APP_URL>`
3. 點 **「使用 LINE 登入」**
4. 跳轉到 LINE 同意授權頁
5. 登入後應該回到你的 app 並建立帳號

❌ **常見錯誤**：

- `redirect_uri_mismatch` → E-2 沒做或值不對
- `invalid_request` → channel 還在 Developing 狀態，但你的測試帳號不是 Tester
  - 解法：到 Channel → Roles → 把你的 LINE 帳號加為 Tester
  - 或：把 Channel 的狀態切到 **Published**（不可逆）

---

## F-3. 在 LINE App 內測試 LIFF

1. 用手機**任何一個 LINE 對話**，貼上你的 LIFF URL：

```
https://liff.line.me/<LIFF_ID>
```

2. 點開 → 應該在 LINE 內以全螢幕開啟你的 app
3. 應該**自動登入**，不需要再按登入按鈕

❌ **常見錯誤**：

- 一直白屏 / 跳出 LIFF 錯誤 → 檢查 LIFF Endpoint URL 是否正確
- 重複跳轉登入頁 → `LIFF_CHANNEL_ID` 設錯，必須等於 `LINE_LOGIN_CHANNEL_ID`

---

## F-4. 測試上傳收據（驗證 Supabase Storage）

1. 登入後，建一筆旅程
2. 新增一筆費用，**上傳收據圖片**
3. 重新整理頁面，確認收據還在
4. 到 Supabase → Storage → `trip-files` bucket → 應該看到一個新的 `uploads/{userId}/...` 物件

❌ **常見錯誤**：

- 上傳失敗 → 檢查 Vercel logs，最常見是 `SUPABASE_SERVICE_ROLE_KEY` 或 `STORAGE_BUCKET` 設錯
- 圖片無法顯示 → 確認 bucket 是 private 且 API 能產生 signed URL

---

## F-5. 測試 LINE 推播（驗證 Messaging API）

1. **先用個人 LINE 加你的 OA 為好友**（用 A-5 OA 的 QR code）
2. 在 app 內，到結算頁
3. 點 **「結算完成並推播」**
4. 應該在 LINE 對話中收到通知

❌ **常見錯誤**：

- 沒收到通知 → 你還沒加 OA 為好友
- `401 Unauthorized` → `LINE_CHANNEL_ACCESS_TOKEN` 錯誤或過期，重新 issue
- OA 自動回了一個訊息 → A-5-5 沒做，回去把「自動回應」關掉

---

# 附錄

## 📋 完整環境變數總清單

對照 `.env.example`，最終你應該有這 21 個變數（Notion 兩個是選填）：

```env
# === Database / Supabase ===
DATABASE_URL
DATABASE_DIRECT_URL
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
STORAGE_PROVIDER
STORAGE_BUCKET

# === Session ===
SESSION_SECRET

# === LINE Messaging API ===
LINE_CHANNEL_ID
LINE_CHANNEL_SECRET
LINE_CHANNEL_ACCESS_TOKEN

# === LIFF ===
LIFF_ID
LIFF_CHANNEL_ID
NEXT_PUBLIC_LIFF_ID

# === LINE Login (Web OAuth) ===
LINE_LOGIN_CHANNEL_ID
LINE_LOGIN_CHANNEL_SECRET
LINE_LOGIN_REDIRECT_URI

# === App ===
APP_URL
NEXT_PUBLIC_APP_URL

# === Cron ===
CRON_SECRET

# === Notion (Optional) ===
NOTION_TOKEN
NOTION_PARENT_PAGE_ID
```

---

## 🚨 安全注意事項

| 千萬別做                                                                    | 原因                                      |
| --------------------------------------------------------------------------- | ----------------------------------------- |
| 把 `.env` commit 到 git                                                     | Secret 外洩                               |
| 把 `LINE_CHANNEL_SECRET` / `LINE_CHANNEL_ACCESS_TOKEN` 貼到聊天室或截圖分享 | 別人可以冒用你的 OA 推訊息                |
| 把 `SUPABASE_SERVICE_ROLE_KEY` 貼到 GitHub Issue / 公開地方                 | 別人可以繞過 RLS 並讀寫你的 Supabase 資源 |
| 在 Production 把 LINE Login channel 設為 Published 後又想改回 Developing    | **不可逆**                                |
| 把 Supabase 的 `Database Password` 用在自己懂的帳號密碼組合                 | 一旦洩漏，整個 DB 被駭                    |

---

## 🔁 之後要更新時的最小流程

| 你改了什麼       | 要做什麼                                             |
| ---------------- | ---------------------------------------------------- |
| 程式碼（src/）   | `git push` → Vercel 自動部署                         |
| Prisma schema    | `git push` → 部署時自動跑 `prisma migrate deploy`    |
| 環境變數         | Vercel → Settings → Env Vars 改完，**手動 Redeploy** |
| 換正式 domain    | 階段 E 全部重做一次（換 LINE 設定的網址）            |
| LINE OA 訊息內容 | https://manager.line.biz/                            |

---

## ❓ 常見問題

### Q1. 我可以先用 ngrok 在本機測試嗎？

可以，但 LINE Login 的 callback URL **必須是公開 https**，所以你要：

1. 跑 `ngrok http 3000` 拿一個臨時 https URL
2. 把這個 URL 暫時設為 `LINE_LOGIN_REDIRECT_URI`
3. 同時更新 LINE Login Channel 的 Callback URL
4. 但 ngrok 每次重啟會換 URL，要再改一次，很煩
   **建議**：直接用 Vercel preview deployment 測，也是免費。

### Q2. 我的 LINE Channel 是「Developing」狀態，朋友登不進去？

Developing 狀態只允許 **Tester 角色**的 LINE 帳號登入。

- 短期：到 Channel → Roles → Add → 把朋友加為 Tester（限 100 人）
- 長期：把 Channel 切換為 **Published**（按 Channel 頁面右上角的 `Developing` 切換）
  - ⚠️ **一旦 Published 就不能改回 Developing**

### Q3. Supabase 免費方案會不會被自動暫停？

會。**連續 7 天沒有任何 query** 就會 pause。隨便登入用一下就會解除。
正式上線後不會發生這問題。

### Q4. Supabase Storage 免費額度夠用嗎？

Free plan 目前包含 1GB file storage 與 5GB egress，對小型 demo、個人旅遊分帳與少量收據通常夠用。
如果收據照片很多，建議壓縮圖片或升級方案。

### Q5. 我可以用自己的網域嗎？

可以。Vercel → Project → Settings → Domains → 新增你的網域，按指示設 DNS。
之後階段 E 的所有設定都改用你的網域即可。

---

## 📚 官方文件參考

| 主題                          | 連結                                                               |
| ----------------------------- | ------------------------------------------------------------------ |
| LINE Login getting started    | https://developers.line.biz/en/docs/line-login/getting-started/    |
| LIFF getting started          | https://developers.line.biz/en/docs/liff/getting-started/          |
| Messaging API getting started | https://developers.line.biz/en/docs/messaging-api/getting-started/ |
| Supabase + Prisma             | https://www.prisma.io/docs/orm/overview/databases/supabase         |
| Supabase Storage              | https://supabase.com/docs/guides/storage                           |
| Vercel env variables          | https://vercel.com/docs/projects/environment-variables             |
| Vercel function regions       | https://vercel.com/docs/projects/edge-network/regions              |
