# GESA Finance Ledger

A transparency-focused finance portal for GESA (Geomatic Engineering Students
Association, UMaT). Members see periodic income/expenditure/balance summaries
per program; the finance executive/admin enters the numbers.

Built with React + Vite + Firebase (Firestore + Auth), same stack as the main
GESA app, so it can be merged in later if this becomes the department's
official tool.

## Demo mode (works right now, no setup)

```
npm install
npm run dev
```

Open the printed localhost URL. With no Firebase project connected yet, the
app runs in **demo mode**: sample periods/transactions are stored in your
browser's localStorage, and the admin login accepts any email + password.
This lets you click through the whole flow — public dashboard, admin login,
adding periods/transactions — before wiring up a real backend.

## Going live with Firebase

1. Create a Firebase project (or reuse the one behind the main GESA app —
   this portal only touches its own `financePeriods` collection, so it won't
   collide with existing app data).
2. Enable **Firestore Database** and **Authentication > Email/Password**.
3. In Authentication > Users, add one user for the finance executive
   (their email + a password).
4. Copy `.env.example` to `.env` and fill in your Firebase config (Project
   settings > General > Your apps > SDK setup and configuration), plus
   `VITE_ADMIN_EMAIL` set to that finance exec's email.
5. Restart `npm run dev` — the app automatically switches out of demo mode
   once `VITE_FIREBASE_PROJECT_ID` is set.

### Firestore structure

```
financePeriods/{periodId}
  name, startDate, endDate, status ("open" | "closed")
  transactions/{transactionId}
    type ("income" | "expenditure"), description, amount, date
```

### Suggested Firestore security rules

Public read, admin-only write — paste into Firestore > Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /financePeriods/{periodId} {
      allow read: if true;
      allow write: if request.auth != null;
      match /transactions/{transactionId} {
        allow read: if true;
        allow write: if request.auth != null;
      }
    }
  }
}
```

## Deploying

```
npm run build
```

Deploy the `dist/` folder to Vercel (same as the GESA admin dashboard) or any
static host. Since routes are client-side (`/`, `/admin`, `/admin/login`),
make sure the host rewrites all paths to `index.html` (Vercel does this
automatically for Vite SPAs).

## Pages

- `/` — public dashboard: ledger strip of programs/periods, income/
  expenditure/balance, transaction log, balance trend chart.
- `/admin/login` — finance exec sign-in.
- `/admin` — create periods, add/remove transactions, mark a period
  open/closed, and generate audit-ready PDF reports.

## Audit reports (admin only)

Members only ever see summary totals on the public page — full itemized
transactions stay inside the admin dashboard. From there, the finance
executive can generate:

- **Audit report (PDF)** — every transaction for one period, itemized, with
  a totals summary. Ready to print or hand over the moment an audit is
  requested.
- **Full audit report (PDF)** — the same, but for every period at once, plus
  a grand-total summary page across the whole term.
- **Export summary / Export full ledger (CSV)** — the same data as CSV, if
  a spreadsheet is more useful than a PDF.

Nothing here needs receipts or photos attached — it's built purely from
what's already logged, so there's nothing extra for the finance exec to do
beyond entering transactions as they happen.
