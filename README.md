# paisavasool

A personal expense app for USA and India: accounts, descriptions that become categories, income, investments, refunds, loans and shared expenses.

**Start with [GITHUB-AND-HOSTING.md](GITHUB-AND-HOSTING.md)** for GitHub, local preview, iPhone use, deployment and future updates.

## Run

    pnpm install --frozen-lockfile
    pnpm dev

Create private .env.local and .env.server files from their example files. Open http://localhost:8081 or /?demo=year for fictional sample data.

## Features
- Week / Month / Quarter / Year reports and a scrollable income/spending chart.
- Swipeable stats that scroll naturally, regular payments and possible duplicate charges.
- Accounts/settings in the top-left drawer. No preset banks for new users.
- Add accounts or confirm statement-detected bank, product and currency before saving.
- PDF (text-based) and CSV statement import; source amounts/dates require review.
- Categorization on by default, with optional corrections in Activity.
- Brief AI failures retry once. Unavailable AI leaves new descriptions in Review; only exact confirmed-history matches can be categorized offline.
- Google sign-in, private cloud records/files and Community feedback via Supabase.

## Checks

    pnpm typecheck
    pnpm test
    pnpm export:web

GitHub Actions runs these checks for pushes to main and pull requests.

## Deployment status and limits
Source is ready for web hosting. GitHub publication, Supabase SQL/function deployment and Google OAuth need the owner's authenticated accounts. Live bank syncing is not enabled. No free AI service guarantees unlimited or uninterrupted use.
Native Apple AI code remains in modules/kinledger-assistant; it requires a supported iPhone, native build, Xcode and device testing. The website uses hosted Groq, not Apple AI.

See [AI-SETUP.md](AI-SETUP.md), [CLOUD-SETUP.md](CLOUD-SETUP.md) and [supabase/community.sql](supabase/community.sql).
Internal storage keys and the native module retain their old Kinledger identifiers to preserve stored records and module compatibility.

