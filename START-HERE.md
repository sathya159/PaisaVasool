# Run, edit and host Kinledger

This folder contains the editable source for your USA/India expense app. Start with the web version on Windows. You do not need an Apple Developer account to run or host the website.

## Important: this is a prototype

The web version saves transactions on this browser across refreshes. This device storage is not encrypted or synchronized and is removed if you clear browser site data. Download your records regularly. Google sign-in, cloud ledgers and private file storage need your project configuration in `CLOUD-SETUP.md`. Hosting alone does not activate them or add bank connections. Use sample transactions while exploring.

Web categorization uses rules and saved category history. Apple's AI and PDF/image statement reading require the separate native iPhone build; they do not run in a website. CSV importing works on the web. Plaid linking is not implemented yet. The native iPhone module is included as source but has not been compiled or tested on an iPhone.

## 1. Install these applications

| Application | Purpose | Download |
| --- | --- | --- |
| Node.js 24 LTS | Runs the development tools; includes npm | https://nodejs.org/en/download |
| Visual Studio Code | Opens and edits the source files | https://code.visualstudio.com/download |
| Edge or Chrome | Displays the app | Your installed browser is sufficient |

Optional later: GitHub Desktop (https://desktop.github.com/) makes saving code history and uploading to your own GitHub repository easier. A Netlify account (https://app.netlify.com/) is needed only if you choose to publish there. Hosting plan allowances are separate from Plaid's plan.

## 2. Open the source folder

1. Download and extract `kinledger-editable-source.zip` using Windows **Extract All**.
2. In VS Code choose **File > Open Folder**.
3. Select the extracted `kinledger` folder containing `package.json` and `App.tsx`.
4. Choose **Terminal > New Terminal**. In its dropdown choose **Command Prompt**. This avoids PowerShell's npm script policy problem.

Run these commands one at a time:

```bat
node --version
npm install --global pnpm@11.19.0
pnpm install --frozen-lockfile
pnpm web
```

The first command should show version 24. Installing dependencies needs internet and can take several minutes. After the web server starts, open the localhost address printed in the terminal, usually http://localhost:8081. If that port is in use, accept another port and use the new address.

Keep the terminal open while using the local website. Stop it with **Ctrl+C**. Next time, open the same folder and run only `pnpm web`.

## 3. Edit the app

| File | What to change |
| --- | --- |
| `App.tsx` | Screens, labels, buttons, colors and layout |
| `src/assistant.ts` | How reasons and past categories choose categories |
| `src/ledger.ts` | Accounts, transactions, transfers, refunds and totals |
| `src/csv.ts` | Reading statement CSV files |
| `src/storage.web.ts` | Persistent browser storage and optional cloud saving |
| `src/cloud.ts`, `src/AccountPanel.tsx` | Google sign-in and cloud files |
| `supabase/schema.sql` | Cloud database, private file storage and user access rules |
| `src/storage.ts` | Native encrypted storage |
| `src/ondevice.ts` | Interface to the native Apple assistant |
| `modules/kinledger-assistant/ios/` | Native iPhone AI and document-reading source |
| `samples/` | Invented CSVs for testing |
| `tests/` | Accounting and categorization checks |
| `app.json` | App name and Expo settings |
| `package.json` | Libraries and runnable commands |

For your first edit, find a visible label in `App.tsx`, change it and press **Ctrl+S**. The running preview normally updates automatically. Keep a copy of the original ZIP or use Git history so you can undo changes.

After changing logic, run:

```bat
pnpm typecheck
pnpm test
```

## 4. Make files that can be hosted

From the same terminal, run:

```bat
pnpm export:web
```

This creates a `dist` folder containing the website. Re-run the command after editing code to update that folder. To preview this built version locally:

```bat
pnpm exec expo serve
```

Use the address printed in the terminal. Do not double-click `dist/index.html`; use a local server or a web host.

## 5. Publish the website with a drag and drop

A separate `kinledger-web-build.zip` contains an already-built copy if you want to try hosting before installing development tools.

1. Extract `kinledger-web-build.zip`. Its `dist` folder should contain `index.html`.
2. Sign into Netlify and open https://app.netlify.com/drop .
3. Drop the **dist folder** onto the deployment area. Upload the built folder, not your source folder or ZIP.
4. Netlify provides an HTTPS website address. Open it on your computer or in Safari on your iPhone.
5. After editing the source, run `pnpm export:web` and upload the new `dist` folder in the existing Netlify project's manual deploy area to update the same site.

No website has been published for you. Check the host's current free-plan limits before publishing. A paid custom domain is optional. A published site works while your computer is off. Device records stay in that browser; configure Google/Supabase to retrieve a user's cloud ledger on other devices.

Optional Git-based deployment: put the source in your own repository, connect it to Netlify, and use build command `pnpm export:web` and publish directory `dist`. The included `netlify.toml` supplies those settings. Keep secrets and personal statements out of your repository.

## 6. What is needed for a real daily-use web app

Before relying on it for your finances, configure and verify the cloud setup and establish backups. A JSON download is available in Accounts. Test two-user isolation as described in `CLOUD-SETUP.md`. For Plaid, add a secure backend, server-side secrets, transaction sync and reconnection handling. Never place Plaid secrets or bank access tokens in frontend code or `EXPO_PUBLIC_` variables.

The current package contains source and invented samples, not your bank accounts, credentials or existing browser-session entries. Sharing the ZIP shares the code, not ledger records.

## Common problems

- **node or pnpm not recognized:** close and reopen VS Code after installation.
- **PowerShell says scripts are disabled:** switch the VS Code terminal to Command Prompt and repeat the command; do not change your system execution policy.
- **Port 8081 is busy:** use the alternate port Expo offers.
- **Changes do not appear on the hosted website:** rebuild with `pnpm export:web`, then upload the new `dist` folder.
- **Different records appear after signing in:** device and cloud ledgers are deliberately separate. Device records are not automatically uploaded into a Google account.
- **Apple AI is unavailable in Safari:** it requires the native iPhone app; use the web rules/history workflow here.

Official references: https://docs.expo.dev/guides/publishing-websites/ and https://docs.netlify.com/deploy/create-deploys/ . See `README.md` for accounting behavior and native-build limitations.

