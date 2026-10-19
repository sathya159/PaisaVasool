# paisavasool: save, publish and update

## What you need
- A GitHub account (sathya159), Git for Windows, Node.js 24, pnpm 11 and VS Code.
- Your existing Supabase project for Google login, private records and AI functions.
- A Netlify account to host the website from GitHub. Check provider usage limits before inviting many users; free plans have limits.

## 1. Put the code on GitHub
The requested repository is sathya159/paisaVasool. Use a private repository.
Create it at https://github.com/new with no README, license or gitignore (these files are already here).
The local project is initialized with Git and its origin points to this repository.
In a terminal in this folder:

    git push -u origin main

Complete GitHub authentication in the browser if asked. Never send passwords or access tokens in chat.
If command-line authentication is difficult, open this folder in GitHub Desktop and sign in there.
Only the source, sample data and setup files are tracked. Real .env files, database files, screenshots and dependency folders are excluded.

## 2. Test locally
Copy .env.example to .env.local only on a NEW checkout; keep your existing file here.
Copy .env.server.example to .env.server only on a NEW checkout and fill your private Groq key.

    pnpm install --frozen-lockfile
    pnpm dev

Open http://localhost:8081. The dev command starts the web app and AI together, and restarts the AI process if it exits.
Open /?demo=year for fictional transactions. Demo never writes to your real ledger.

## 3. Finish Supabase
Do not rerun schema.sql if you already ran it successfully. Keep the SQL file in the repository so future setup is reproducible.
Run supabase/community-chat.sql in SQL Editor to enable the shared Community chat. Every signed-in member can read the conversation.
Run supabase/ai-quota.sql once if it has not already been applied.
Configure Google provider and redirect addresses as described in CLOUD-SETUP.md.
Deploy the updated AI function from THIS checkout:

    pnpm dlx supabase login
    pnpm dlx supabase link --project-ref YOUR_PROJECT_REF
    pnpm dlx supabase functions deploy categorize --no-verify-jwt

The function validates the user itself. Set GROQ_API_KEY and AI_ALLOWED_ORIGIN in Supabase Edge Function secrets, using your final website origin without a trailing slash.
Bank account discovery in statements requires this updated function. Backend changes are deployed separately from the website.
Community is a shared chat for signed-in users, with live messages and polling fallback. The new community_messages table is separate from old private feedback. Old feedback remains private. App owners can moderate messages in Supabase Table Editor. There are no notification emails.

## 4. Publish the website
In Netlify choose Add new project -> Import an existing project -> GitHub -> sathya159/paisaVasool.
Use main as the production branch. netlify.toml supplies the build command and dist publish directory.
Add environment variables in Netlify:
- EXPO_PUBLIC_SUPABASE_URL
- EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- EXPO_PUBLIC_LOCAL_AI=false

Never put GROQ_API_KEY or a Supabase service-role key in public website variables or GitHub files.
Deploy, then add the final HTTPS website URL to Supabase Auth redirect URLs and set the Site URL. Set the same origin as AI_ALLOWED_ORIGIN. Redeploy the AI function if its code changed.
Test with two separate user accounts before inviting other people: each must only see their own ledger and files, while both must see shared chat messages.

## 5. Open it on your iPhone
Open the published HTTPS website in Safari, sign in, and use Share -> Add to Home Screen.
This is the web application; it works while your computer is off when the Supabase function is deployed. Apple AI is available only in a separately compiled native iPhone build. The native build still needs Xcode/device verification.
The website loads updates on refresh/reopen. This release does not cache private financial records with a service worker.

## 6. Make updates and pull requests
I can continue editing this repository and making UI/code changes.

    git switch main
    git pull --ff-only
    git switch -c feature/short-description

Edit and test:

    pnpm typecheck
    pnpm test
    pnpm export:web
    git add src App.tsx
    git commit -m "Describe the change"
    git push -u origin feature/short-description

Open GitHub -> Compare & pull request. Review and merge into main to trigger Netlify deployment.
Git pull DOWNLOADS changes; git push UPLOADS changes. A pull request asks to merge a branch. Users do not run Git; they reopen the website to load the new version.
Database SQL and Edge Function updates require their separate deployment steps. Avoid destructive schema changes and export data before migrations.

Official references: https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github and https://docs.netlify.com/build/configure-builds/file-based-configuration/

## Community pictures
After community-chat.sql, run supabase/community-images.sql in Supabase SQL Editor. Members can attach JPG, PNG or WebP images up to 5 MB, preview them before sending, add optional captions, and tap shared images to enlarge. Images are in a private bucket with expiring signed URLs. Only signed-in members can read images attached to group messages. Text chat still works before applying the image migration. Failed uploads keep the draft; successful uploads with unconfirmed messages may leave unused objects for the owner to clean up later.

