# TripSplit

A self-hosted travel expense tracker and bill-splitting web app for groups. Record expenses on the go, handle multi-currency with live exchange rates, and get an optimized settlement plan at the end of your trip.

## Features

**Expense tracking**
- Add, edit, and delete expenses with categories, notes, and receipt photos
- Multi-currency support with automatic exchange rate lookup
- Custom expense categories per trip
- Keyword, category, payer, and date-range filtering

**Flexible bill splitting**
- Equal split, payer-only, percentage, or exact-amount per member
- Mark expenses as excluded from settlement, handled offline, or partially settled

**Settlement**
- Minimized-transfer settlement algorithm
- Per-person breakdown — see who owes whom and why
- Mark payments as completed, add notes, and undo
- Export as TXT, CSV, JSON, PDF, or image

**Collaboration**
- Invite members via a unique invite code
- Role-based permissions — trip owner controls members and categories
- In-app notification centre with per-user preference toggles
- Full activity log per trip

**Backup & restore**
- Export a full JSON backup from the client or trigger a server-side backup
- Re-import any JSON backup as a new trip

**Internationalisation**
- zh-TW and English UI (`LocaleProvider` + typed `t()` helper)
- Locale preference persisted to `localStorage`

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | SQLite via Prisma ORM |
| Validation | Zod |
| Charts | Recharts |
| Export | jsPDF + html2canvas |
| Date handling | date-fns |

## Getting started

### Prerequisites

- Node.js 18+

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file:
   ```env
   DATABASE_URL="file:./dev.db"
   ```

3. Initialise the database:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) and sign in at `/login`.

> [!NOTE]
> The first time you visit `/login`, enter any email and a display name — the system will create your account automatically.

## Project structure

```
src/
├── app/
│   ├── api/                # API routes (auth, trips, expenses, members,
│   │   │                   #   payments, notifications, upload, exchange-rate)
│   ├── trips/[tripId]/     # Trip detail page (expenses, settlement, stats, summary)
│   ├── trips/new/          # New trip creation
│   ├── login/              # Authentication
│   └── page.tsx            # Home — trip list, notifications, backup import
├── lib/
│   ├── settlement.ts       # Settlement calculation logic
│   ├── validations.ts      # Zod schemas for all API inputs
│   ├── fetch.ts            # Centralised safeFetch with error handling
│   ├── notifications.ts    # Notification creation with preference filtering
│   ├── i18n/               # LocaleProvider, useLocale(), zh-TW + en dictionaries
│   └── constants.ts        # Default expense categories, currencies, split types
└── prisma/
    └── schema.prisma       # Data models
```

## Data models

| Model | Purpose |
|---|---|
| `Trip` | A travel group with currency, invite code, and owner |
| `Member` | A person in a trip, optionally linked to a `User` |
| `Expense` | An expense with splits, settlement mode, and optional receipt |
| `Split` | Per-member share of an expense |
| `SettlementPayment` | A recorded payment between two members |
| `ActivityLog` | Immutable audit trail for all trip operations |
| `Notification` | In-app notification, filtered by `NotificationPreference` |
| `CustomCategory` | Trip-scoped user-defined expense category |
| `BackupRecord` | Metadata for server-side backup files |

## Development commands

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run start        # Serve production build
npm run lint         # ESLint check
npx prisma studio    # Open database GUI
```

## Known limitations

- SQLite is used for simplicity; not suitable for multi-instance deployments without a shared filesystem.
- Email and push notifications are not implemented — only in-app notifications.
- Automated backup scheduling is not built in; backups must be triggered manually.
