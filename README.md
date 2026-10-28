# My lecture notes

React + Vite front end, Supabase (database, image storage, login) back end, hosted on Vercel. All free tier.

## 1. Create the Supabase project
1. Sign up at https://supabase.com → **New project** (pick a region near you, save the DB password).
2. **SQL Editor → New query**: paste `supabase/schema.sql` and **Run**. This creates the tables, the per-user
   security rules, the private `lecture-images` bucket, and a trigger that gives every new account 8 sessions per subject.
3. **Authentication → Sign In / Providers**: keep "Allow new users to sign up" on, and choose whether new users must
   confirm their email (see *Sign-ups* below).
4. **Authentication → URL Configuration**: set *Site URL* to your deployed URL (e.g. your Vercel domain).
5. **Project Settings → API Keys**: copy the Project URL and the *publishable* key.

## 2. Run locally
```bash
cp .env.example .env      # then paste the URL and key into .env
npm install
npm run dev               # http://localhost:5173
```
Edit `src/config.ts` to set your programme, university and academic year.

## 3. Deploy to Vercel
1. Push this folder to a new GitHub repo (private is fine):
   ```bash
   git init && git add . && git commit -m "Lecture notes site"
   gh repo create lecture-notes --private --source=. --push   # or create it on github.com and push
   ```
2. https://vercel.com → **Add New → Project** → import the repo. Framework preset: **Vite** (auto-detected).
3. Under **Environment Variables** add `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY`, then **Deploy**.
4. In Supabase → **Authentication → URL Configuration**, set *Site URL* to your Vercel URL.

Every `git push` redeploys. `vercel.json` makes `/subjects/...` links work on refresh. (On Netlify, `public/_redirects` does the same.)

## Privacy & accounts
Every user has their own private notebook: all pages require signing in, the database only returns a user's own rows,
and images live in a private bucket under `<user id>/...`, shown through 6-hour signed URLs.

Upgrading a project created before multi-user support: run `supabase/migrations-002-private.sql`, then
`supabase/migrations-003-multi-user.sql` (it assigns all existing notes to the one existing account), and only then
turn sign-ups on.
To add document uploads (PDF, PowerPoint, Word, Excel), run `supabase/migrations-004-documents.sql` before deploying.
To make notes editable, run `supabase/migrations-005-note-edits.sql` before deploying.
For the session checklist (attended / reviewed), run `supabase/migrations-006-session-checklist.sql` before deploying.
For the question bank and practice mode, run `supabase/migrations-007-questions.sql` before deploying.
For sharing between accounts, run `supabase/migrations-008-sharing.sql` before deploying.

### Sign-ups
- Confirmation emails: Supabase's built-in email sender only delivers to your project's team members and is heavily
  rate-limited. For other people to sign up, either turn **Confirm email** off (Authentication → Sign In / Providers →
  Email), or add your own SMTP provider (Authentication → Emails → SMTP Settings; e.g. Resend's free tier).
- To close sign-ups again, turn off "Allow new users to sign up"; existing users keep working.

## Free-tier notes
Supabase pauses free projects after ~1 week with no activity; open the site or the dashboard to wake it.
Storage is 1 GB; large photos are downscaled to max 2400 px before upload.
