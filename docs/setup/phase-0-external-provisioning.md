# Phase 0 — External Provisioning

這份文件是人工操作指引；請先完成所有外部服務開通與設定，再開始寫任何程式碼。

## LINE Developers / LIFF

1. 前往 LINE Developers Console 建立 provider 與應用相關設定。
   - 官方文件：<https://developers.line.biz/console/>
2. 建立 LIFF app 時，LIFF size 請選 **Full**。
3. LIFF 的 endpoint URL 先暫填預期的 Vercel URL，之後部署完成再回填正式網址。
4. 參考文件：
   - LINE Developers Console: <https://developers.line.biz/console/>
   - LIFF 入門: <https://developers.line.biz/en/docs/liff/getting-started/>

```env
# LIFF app 的公開識別碼。前端實際使用 NEXT_PUBLIC_LIFF_ID。
LIFF_ID=your-liff-id-here

# LIFF 所屬 channel id，後端驗證 LIFF ID Token audience 會使用。
LIFF_CHANNEL_ID=your-liff-channel-id-here

# 前端在瀏覽器端使用的 LIFF ID
NEXT_PUBLIC_LIFF_ID=your-liff-id-here
```

## LINE Login Channel

1. 建立 LINE Login channel，並完成 OAuth 相關設定。
2. 設定 redirect URI 為正式可用的外部網址。
3. 參考文件：
   - LINE Login: <https://developers.line.biz/en/docs/line-login/>

```env
# LINE Login channel id
LINE_LOGIN_CHANNEL_ID=your-line-login-channel-id-here

# LINE Login channel secret
LINE_LOGIN_CHANNEL_SECRET=your-line-login-channel-secret-here

# LINE Login OAuth redirect URI
LINE_LOGIN_REDIRECT_URI=your-redirect-uri-here
```

## LINE Official Account

1. 建立或準備對應的 LINE Official Account。
2. 啟用 Messaging API，完成 webhook 與權杖設定。
3. Webhook URL 設為：`https://your-app.vercel.app/api/line/webhook`。
4. LINE Push 目前只會在旅程建立者於結算頁手動按下「結算完成並推播」後發送；不需要設定排程推播。
5. 參考文件：
   - LINE Messaging API 入門: <https://developers.line.biz/en/docs/messaging-api/getting-started/>

```env
# Messaging API channel id
LINE_CHANNEL_ID=your-line-channel-id-here

# Messaging API channel secret
LINE_CHANNEL_SECRET=your-line-channel-secret-here

# Messaging API channel access token
LINE_CHANNEL_ACCESS_TOKEN=your-line-channel-access-token-here
```

## Supabase

1. 建立 Supabase project，並完成 PostgreSQL 資料庫準備。
2. 取得 Prisma 需要的連線字串，分成 pooled 與 direct 連線。
3. 在 Storage 建立 private bucket，例如 `trip-files`，用於收據圖片與備份檔。
4. 取得 Project URL 與 service role key。service role key 只能放在 Vercel server-side 環境變數，不能加 `NEXT_PUBLIC_`。
5. 參考文件：
   - Supabase + Prisma: <https://supabase.com/partners/integrations/prisma>
   - Supabase Storage: <https://supabase.com/docs/guides/storage>

```env
# Pooled database connection string for Prisma runtime usage
DATABASE_URL=your-database-url-here

# Direct database connection string for migrations and direct access
DATABASE_DIRECT_URL=your-database-direct-url-here

# Supabase project URL for Storage SDK
SUPABASE_URL=https://your-project-ref.supabase.co

# Server-only secret key for Storage operations
SUPABASE_SECRET_KEY=your-supabase-secret-key-here

# Object storage settings
STORAGE_PROVIDER=supabase
STORAGE_BUCKET=trip-files
```

## Vercel

1. 建立 Vercel project，並將部署區域 pin 到與 Supabase 相同區域。
2. **推薦使用 sin1（新加坡）**，以降低跨區延遲。
3. 將外部可訪問的 base URL 設為正式部署網址。
4. 在 Vercel Environment Variables 設定本文件列出的必要環境變數。
5. 目前不需要設定 Vercel Cron；結算提醒由旅程頁手動觸發。
6. 參考文件：
    - Vercel 環境變數: <https://vercel.com/docs/projects/environment-variables>

```env
# Base URL that users and external services can reach
APP_URL=your-app-url-here

# Public base URL for client-side links such as invite URLs
NEXT_PUBLIC_APP_URL=your-app-url-here
```

## Notion Export（Optional）

若要啟用匯出到 Notion，需先建立 Notion integration，並將目標 parent page 授權給該 integration。

參考文件：
- Notion integrations: <https://developers.notion.com/docs/create-a-notion-integration>

```env
# Notion integration secret
NOTION_TOKEN=your-notion-token-here

# Notion parent page id
NOTION_PARENT_PAGE_ID=your-notion-parent-page-id-here
```
