# Google sign-in and cloud saving

The app now saves device-mode transactions in this browser across refreshes. Google login, online ledgers and private statement files are implemented but need your Supabase project configured. No cloud credentials, live Google connection or paid AI service have been added.

## Set up your project

1. Create your own free project at https://supabase.com/dashboard . Keep the database password private.
2. Open the project's SQL Editor. Paste the contents of `supabase/schema.sql` and run it once. This creates a ledger per user, access rules and a private `statements` bucket.
3. In Google Cloud Console, create a project and configure Google Auth Platform branding and audience. For testing, add your Gmail as a test user. Request only openid, email and profile; Gmail inbox access is not needed.
4. Create a Web application OAuth client. Add your website origin and `http://localhost:8081` as authorized JavaScript origins. Use the callback URL shown in Supabase Authentication > Sign In / Providers > Google as Google's authorized redirect URI.
5. Enable Google in Supabase and paste the Google client ID and client secret there. Never put the Google secret in this app's files.
6. In Supabase Authentication > URL Configuration, set Site URL to your website and allow that URL and `http://localhost:8081/` as redirect URLs. Add the exact local port if different.
7. Create a file named `.env.local` beside `package.json` with these two lines, replacing the placeholders with your project's URL and public publishable key:

```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
```

Use the public publishable key (or legacy anon key), never a secret/service_role key. The row access rules in the SQL file are essential; a public key does not protect data by itself.

8. Stop the Expo terminal and run `pnpm web` again. Go to Accounts > Continue with Google.
9. For your hosted website, set the same public environment values in the build environment and rebuild with `pnpm export:web`. A previously built ZIP does not acquire configuration automatically.

Official Google setup: https://supabase.com/docs/guides/auth/social-login/auth-google

## What is saved

- Device mode: ledger only, in browser localStorage. It survives refresh but is not encrypted and does not sync. Clearing site data deletes it. Download records regularly.
- Signed in: ledger in Supabase, protected by the user's ID and row access policies. No cloud ledger is cached in device-mode storage. Signing out opens the separate device ledger.
- Accounts > Save a statement or receipt: upload an original PDF/CSV/text/image under 5 MB to your private cloud files. This archives the document; it does not import its transactions. The import workflow remains separate. Show my saved files allows downloads.
- Download my records: JSON export of the current ledger, including categories, reasons and accounts. It does not include original file bytes or sign-in tokens. Keep downloaded financial files private. Automated restore/merge is not included yet.
- Local records are not silently uploaded into a Google account. Device and cloud ledgers are separate. Export before switching. Importing a statement while signed in saves its transactions to that cloud account.

Cloud saves happen when you save a transaction or change the ledger. Failed saves show an error and do not pretend the data is saved. Reload/sign-in retrieves current cloud data; live cross-device push is not implemented. Concurrent cloud edits are rejected using a revision check rather than silently replacing another device's changes. Export current records and reload if you see that message.

The browser categorizer uses rules and saved history. No hosted LLM receives your financial text. Apple AI remains native-iPhone-only and not device-tested. Google sign-in is for this web build; native OAuth needs a separate deep-link setup.

## Before using real data or sharing

Test with two separate Google accounts: each must see only its own ledger and files, including after sign-out and sign-in. Verify that an anonymous request and user B cannot retrieve user A's ledger or statement paths. Try saving from two tabs; the stale tab should get a conflict. Verify offline writes fail visibly. These live tests cannot run until your project is configured. The supplied SQL and OAuth code have not been tested against a real Supabase project here.

Supabase free-plan storage and inactivity limits still apply. Scheduled backups, file deletion UI, account deletion, automatic local-to-cloud migration, and shared family access are not implemented. The cloud provider and project administrator can access data; this is not end-to-end encryption.

