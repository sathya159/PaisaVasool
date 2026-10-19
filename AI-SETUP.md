# Add real AI to Kinledger

Groq categorization is now wired into **Save** and **Save from my reason**. It uses the description plus up to 12 saved examples, defaults to Myself, reuses suitable categories, and asks a purpose question when needed. Apple AI remains preferred on a supported native iPhone build. Groq does not run continuously: one request is made when categorizing.

The website supports AI import of CSV and text-based PDF statements through one Accounts entry point. The statement text is sent to Groq for bank/account/currency and row extraction. Confirm the preview and import dates before saving. Scanned PDFs, images, and encrypted PDFs without a usable text layer are not supported by this browser flow. Native Apple statement reading remains separate; live bank connections are not activated.

## First: replace the exposed key

Revoke the key posted in chat at https://console.groq.com/keys and create a replacement. Do not paste the replacement into chat, GitHub, or an EXPO_PUBLIC variable. Stay on Groq's Free plan for zero API charges. Free allowances and availability can change. In Groq Data Controls enable Zero Data Retention. Descriptions and selected history still travel to Groq for processing.

## Try on this computer

1. Open a terminal in this project folder (the folder with package.json).
2. Create **.env.server** in this folder with the following line, replacing the placeholder privately in your editor:

   ```dotenv
   GROQ_API_KEY=YOUR_NEW_KEY
   ```

3. Local AI is enabled by default at localhost:8081. **.env.local** already contains the following setting. Use `false` instead to return to rules/history, and preserve any existing Supabase settings:

   ```dotenv
   EXPO_PUBLIC_LOCAL_AI=true
   ```

4. Start the AI backend in a terminal:

   ```powershell
   node --env-file=.env.server server/local-ai.mjs
   ```

5. In another terminal start/restart the web preview:

   ```powershell
   pnpm web --localhost --port 8081
   ```

6. Open http://localhost:8081. In Add transaction, enter an amount and “Paid for dinner at a restaurant”, then Save. A successful request should choose Dining. Try “Sent Sunandhan money” to check the purpose question.

The local backend listens only on your computer. It accepts this exact preview origin, and limits attempts to 100 per UTC day (counter resets if the backend restarts). It does not log keys or transaction text. Saving a replacement key in .env.server takes effect on the next request. Local mode is disabled automatically on other website addresses; it cannot be used from your phone.

## Use it on your phone through the hosted website

Use the Supabase project from CLOUD-SETUP.md. The website and Supabase/Groq accounts must stay within their free allowances; this is not an unlimited free-service promise.

1. Finish Google sign-in and the ledger setup in CLOUD-SETUP.md.
2. Run **supabase/ai-quota.sql** in the Supabase SQL editor. This adds an atomic limit of 100 AI attempts per user/day and 500 total/day. Failed provider requests count. Only the backend can consume this quota.
3. In Supabase **Edge Functions → Secrets**, add **GROQ_API_KEY** with your replacement key and **AI_ALLOWED_ORIGIN** with your exact website origin, e.g. `https://your-site.netlify.app` (no trailing slash).
4. From this project folder, deploy with the Supabase CLI:

   ```powershell
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase functions deploy categorize --no-verify-jwt
   ```

   The function explicitly verifies the user's access token using Supabase Auth before calling Groq. The gateway flag avoids legacy JWT/API-key incompatibility; the endpoint is NOT anonymous. It also enforces the allowed origin and database quota. The function imports the shared server/groq.ts file; deploy from this project, not by copying index.ts alone.

5. Configure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY for the website as described in CLOUD-SETUP.md. Remove EXPO_PUBLIC_LOCAL_AI from the hosted build configuration. Build and publish the website again.
6. On your iPhone, open your hosted URL in Safari, sign in, and save an expense. The computer can be off. You may use Share → Add to Home Screen.

Never put GROQ_API_KEY or SUPABASE_SERVICE_ROLE_KEY into the website's public environment variables. Supabase supplies the function's service credentials automatically. API keys are not stored in the ledger, browser storage, or exports.

## What failures mean

- **Backend not configured:** add the private key and start/deploy the backend.
- **Sign in:** hosted AI requires a valid user session.
- **Daily/free limit reached:** wait until the allowance resets or use Adjust category (optional). No automatic paid upgrade or unlimited retry loop is included.
- **Unclear purpose:** add to the description and save again. The AI does not invent what a friend used the money for.
- **Transfer/refund:** use the existing matching workflow to avoid counting money twice.

The app validates response structure and money direction before saving. Model judgments can still be wrong; category corrections remain available and become history. Brief provider failures retry once. On continued failure, the app explains that AI is unavailable and reuses only exact confirmed-history matches; other new entries are saved for Review with their description preserved.

## Validation status

Automated tests use a mocked Groq response to verify privacy field filtering, limits, errors, and output validation. Live Groq checks now verified a loan to Sunandhan, a missing-location question, and merchant extraction from bank text. Hosted Supabase SQL/auth and native Swift still need deployment/device testing.

References: https://console.groq.com/docs/structured-outputs · https://console.groq.com/docs/your-data · https://supabase.com/docs/guides/functions/auth

## Loans and Activity

Named loans lent out now save as Loans lent, separate from expenses and income. The Money owed to you dashboard shows outstanding loans, shared expenses, and repayments across all recorded dates, separately for USD and INR. Open an expense, enter who owes you and their total share, and save the shared amount. Log incoming repayments using Save incoming payment to match later, then open the incoming entry and choose Match a loan repayment or Match a shared-expense repayment. Partial repayments are supported. Loan repayments are not income; shared-expense repayments reduce spending. Activity leads with merchant/recipient and category; your original detailed reason is visible only when you open the transaction. For ordinary spending, AI asks where only if it cannot identify the merchant in your description or bank text. Existing records are preserved; entries with no stored location can be edited and categorized again.

## Dashboard and imports

The Overview has one horizontally swipeable stats carousel: summary, monthly trends, vendors, categories, recurring-payment candidates, and money owed. Stats scroll naturally without collapsing. Week, Month, Quarter and Year adjust reports; tap a month in the income/spending chart to inspect it. Activity has direct USA/India filters and date controls. The 2025 demo contains 371 invented transactions in a read-only view and never writes to your ledger. Open /?demo=year to view it directly.

Recurring candidates require similar charges in two consecutive months and exclude frequent everyday-spending categories. They are patterns, not confirmed active subscriptions. Charts use original account currencies, never a guessed exchange rate.

Accounts has one Import a statement button. Import limits: 5 MB, 20 PDF pages, 30,000 extracted characters, 120 rows; split larger statements. Unknown account/currency needs confirmation. The PDF worker is bundled at public/pdf.worker.min.mjs; when updating pdfjs-dist copy its build/pdf.worker.min.mjs there before rebuilding. Manual CSV mapping remains available as a fallback. Hosted users must redeploy the updated categorize Edge Function and web build for statement support.

AI may recognize incoming refunds, roommate shares, or loan repayments and save an unreviewed incoming entry, then open matching. Totals change only after you confirm the original transaction. Imported repayments use the same flow. If no shared amount was recorded, matching records the known returned share; it does not guess any remaining debt.

Use pnpm dev to start the preview and AI together. New bank identities are proposed from statement headers and explicitly confirmed before importing. See GITHUB-AND-HOSTING.md for current deployment steps.

