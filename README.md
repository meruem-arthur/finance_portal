# GESA Finance Portal

Income, expenditure and semester budgets for **one department**. It is not multi-tenant. It pulls dues income live from the dues portal and adds a ledger and per-semester program budgets.

Stack: Next.js 14, TypeScript, Prisma + Postgres (its own database), Auth.js, Tailwind.

## How it fits together

- **Sign-in**: there is no password. People sign in through the dues portal ("Finance Portal" link in its sidebar). The dues portal sends a 60-second signed token; this app accepts it once.
- **Roles** (granted inside this app):
  - *Super admin* - automatically, for dues-portal super admins. Sets semesters and the programs pool, approves budgets, manages the team.
  - *Financial secretary* - granted by the super admin (Team page, or pre-approve an email). Logs income/expenditure, builds program budgets, submits them.
  - Anyone else who signs in lands on "Waiting for access".
- **Dues income**: payments arrive by signed push the moment they are confirmed; a daily sync and a "Sync now" button catch anything missed and pick up corrections such as refunds. Dues income is read-only here. No student names are ever received.
- **Semesters**: half an academic year; dates never overlap. A dues payment or ledger entry belongs to the semester whose dates contain its paid/entry date.
- **Budgets**: the super admin sets a *programs pool* per semester. Programs have cost lines and optional expected-sales lines. A program ties up its **upfront cost** (expected sales never reduce it). Over-allocation is flagged with suggestions for where to cut, and a program cannot be approved if approved programs would exceed the pool.
- **Money** is stored as whole pesewas. Nothing is deleted: ledger mistakes are voided with a reason, and everything is audit-logged.

## Setup

1. Create a **new** Postgres database for this app (e.g. on Neon).
2. `cp .env.example .env` and fill it in. `DEPARTMENT_CODE`, `DUES_API_KEY` and `DUES_PUSH_TOKEN` must match `FINANCE_DEPARTMENT_CODE`, `FINANCE_API_KEY` and `FINANCE_PUSH_TOKEN` in the dues portal (see its `docs/finance-integration.md`).
3. `npm install`
4. `npx prisma migrate deploy` (creates the tables)
5. `npm run dev` (port 3000 by default; use `npx next dev -p 3001` if the dues portal is on 3000)
6. Open the dues portal, sign in as super admin, click **Finance Portal** in the sidebar.
7. In Finance: **Semesters** -> add the two semesters, then **Budgets** -> set the pool, then **Dues income** -> **Sync now**.

Deploying to Vercel: set the same environment variables, `NEXTAUTH_URL` to the public URL, and the build command stays `npm run build` (it runs `prisma migrate deploy` first). The daily sync is configured in `vercel.json` and needs `CRON_SECRET`.

## Scripts

`npm test` - unit tests · `npm run lint` · `npm run build`

## Not built yet

PDF audit reports (the old portal's jsPDF export is not ported; the ledger CSV export is), the budget optimizer that trims individual line items, PDF budget import, and the optional public summary page.
