# Swipeable dashboard and unified statement import

- One paged stats carousel, collapsible on vertical scroll, with recent activity underneath. Country and period controls are consolidated. Activity exposes USA/India filters.
- Monthly and vendor analytics, category chart, recurring candidates, and outstanding repayments. A separate 359-transaction demo year leaves real data untouched.
- One Accounts import handles CSV and text-based PDF, suggests bank/account/currency, and requires preview confirmation. Unknown accounts are not guessed; scanned PDF OCR is not included.
- Incoming refund/roommate descriptions save a review entry and open matching before totals are adjusted.
- Browser checks verified iPhone-sized carousel/collapse, country filters, PDF text extraction, and a roommate repayment save-and-match flow. Live Groq verified account/currency extraction and repayment intent.

# Loans, shared expenses and compact Activity

- Money owed to you shows outstanding loans, shared expenses, and repayments for each currency across all recorded dates. Incoming repayments can be matched partially; overpayments and duplicate matches are rejected.
- Shared amounts are explicitly entered in transaction details. Loan principal returned is excluded from income; shared-expense repayments reduce spending.
- Activity shows merchant/recipient, category, amount and date. The detailed reason is visible when opened. Known merchant typos such as chickfilaes normalize to Chick-fil-A; the original text is retained.

# Groq AI integration

- Groq now powers description-based categorization when configured; Apple AI remains preferred on supported native builds. Both new entries and imported transaction review use the same routing.
- Added a loopback-only development backend and an authenticated Supabase Edge Function with persistent user/global daily quotas. Secrets never enter the web bundle.
- Invalid, uncertain, or failed responses do not auto-save. Manual correction remains available. See AI-SETUP.md for private key setup and deployment.
- Groq statement extraction and live bank linking are not included. Live provider and deployed Supabase verification require a replacement key/project.

# Earlier: simplified expense review and optional cloud accounts

- Review shows one expense at a time with Myself selected by default. Describe the purpose; the app picks the category. Change the beneficiary only when needed, or mention family in the reason.
- Existing transaction details, manual category corrections, dates and country filters are tucked away. Accounts shows USA and India without country filters.
- Browser device records persist across refreshes. Accounts provides JSON export. This storage is unencrypted and browser-specific.
- Google sign-in, per-user Supabase ledgers, revision-checked cloud saves, and private original-file upload/download are implemented. See CLOUD-SETUP.md. No live project or credentials have been configured, so OAuth, row access policies and file access still need live testing.
- Rules now distinguish purchase context such as dinner from an incidental college visit, and reuse consistent custom categories for related purposes.
- Native Apple AI instructions default to Me without asking for a relationship. Native Swift still needs compilation and device validation. Web categorization is rules/history, not a connected LLM.

Validation: 39 unit tests, TypeScript checking and web export passed. Browser tests checked Myself defaults, description-based categorization, optional correction, a full refresh retaining sample records, reduced form controls and clear Google setup messaging. Preview uses invented sample transactions only. Bank linking, cloud deployment and native iPhone installation have not been performed.

