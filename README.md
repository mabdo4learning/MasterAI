# Lecturefolio

React + Vite front end, Supabase (database, image storage, login) back end, hosted on Vercel. All free tier.

## 1. Create the Supabase project
1. Sign up at https://supabase.com → **New project** (pick a region near you, save the DB password).
2. **SQL Editor → New query**: paste `supabase/schema.sql` and **Run**. This creates the tables, the per-user
   security rules, the private `lecture-images` bucket, and the per-user `subjects` table. New accounts pick their subjects in an onboarding wizard.
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
For subject details and subject attachments, run `supabase/migrations-009-subject-details.sql` (after 008) before deploying.
For subjects you set up yourself (and the onboarding wizard), run `supabase/migrations-010-custom-subjects.sql` (after 009) before deploying. Existing accounts keep their ten subjects.

### Sign-ups
- Confirmation emails: Supabase's built-in email sender only delivers to your project's team members and is heavily
  rate-limited. For other people to sign up, either turn **Confirm email** off (Authentication → Sign In / Providers →
  Email), or add your own SMTP provider (Authentication → Emails → SMTP Settings; e.g. Resend's free tier).
- To close sign-ups again, turn off "Allow new users to sign up"; existing users keep working.

## Study assistant (AI)
Each session has a **Study assistant** (a Pro feature — see *Payments* below) that turns its notes into a revision summary (saved as a note if you like) or
exam-style practice questions (added to the question bank). It runs in the `study-assistant` Supabase Edge Function,
which calls Google Gemini (`gemini-flash-latest` by default) with your Gemini API key; the key never reaches the browser.

1. Run `supabase/migrations-011-ai-usage.sql` in the SQL editor (new projects: it's already in `schema.sql`).
2. Get a free API key at https://aistudio.google.com/apikey, then with the Supabase CLI (`npx supabase` works without installing):
   ```bash
   supabase login
   supabase link --project-ref <your project ref>
   supabase secrets set GEMINI_API_KEY=AIza...
   supabase functions deploy study-assistant
   ```
3. Optional secrets: `GEMINI_MODEL` (any model your key can use), `AI_DAILY_LIMIT` (requests per user per 24 hours, default 40) and `ALLOWED_ORIGINS`
   (comma-separated, e.g. `https://your-app.vercel.app`; default allows any origin — requests still need a signed-in user).

Every request is logged in `ai_usage` with its token counts, so you can watch spend in the Table Editor. The function
only reads notes through the signed-in user's own login, so row level security applies to the assistant too.

**Free tier caveats:** Google may use free-tier requests to improve its models (the Privacy Policy says so), the
free tier has per-minute and per-day rate limits, and Google's terms may require the paid tier for users in the
EEA, UK or Switzerland. Enabling billing on the key in Google AI Studio lifts all three; then update the Privacy Policy.

## Payments (Lecturefolio Pro)
Pro costs $5/month or $40/year and unlocks the study assistant; everything else stays free. Payments go through
**Paddle Billing**, which is the seller of record: it handles checkout, VAT/sales tax, invoices and payouts.

1. Run `supabase/migrations-012-subscriptions.sql` in the SQL editor (new projects: it's already in `schema.sql`).
2. In Paddle (start in the **sandbox**, https://sandbox-vendors.paddle.com):
   - **Catalog → Products:** create *Lecturefolio Pro* with two recurring prices, $5 monthly and $40 yearly. Copy both `pri_...` ids.
   - **Developer tools → Authentication:** create a client-side token, and an API key with the
     `customer_portal_session.write` and `subscription.write` permissions (the second lets account deletion cancel a subscription).
   - **Checkout → Checkout settings:** add your site's domain (and `localhost` for testing) to the approved domains.
3. Deploy the two billing functions and their secrets:
   ```bash
   supabase secrets set PADDLE_API_KEY=pdl_sdbx_apikey_... PADDLE_ENV=sandbox
   supabase functions deploy billing-portal
   supabase functions deploy paddle-webhook --no-verify-jwt
   ```
4. **Developer tools → Notifications:** add a destination `https://<project-ref>.supabase.co/functions/v1/paddle-webhook`
   with all `subscription.*` events. Copy its secret key, then `supabase secrets set PADDLE_WEBHOOK_SECRET=pdl_ntfset_...`.
5. Add `VITE_PADDLE_CLIENT_TOKEN`, `VITE_PADDLE_ENV`, `VITE_PADDLE_PRICE_MONTHLY` and `VITE_PADDLE_PRICE_YEARLY` to `.env`
   and to Vercel's environment variables (see `.env.example`). Test with Paddle's sandbox test cards.
6. Going live: repeat 2–5 in the live Paddle account (live token, `pdl_live_apikey_...`, drop `PADDLE_ENV`,
   `VITE_PADDLE_ENV=production`). If you change the prices, update `PRICING` in `src/lib/billing.ts` to match.

To give an account Pro without paying (yourself, testers), run in the SQL editor:
```sql
insert into public.subscriptions (user_id, source, status)
select id, 'comp', 'active' from auth.users where email = 'you@example.com'
on conflict (user_id) do update set source = 'comp', status = 'active';
```

## Account deletion
Users can delete their account in **Settings → Delete account**. The `delete-account` Edge Function checks their password
again, cancels a live Paddle subscription immediately (it stops without deleting anything if that fails), removes their
files from storage, and deletes the auth user; every table cascades from `auth.users`, so all their rows go with it.
```bash
supabase functions deploy delete-account
```

## Free-tier notes
Supabase pauses free projects after ~1 week with no activity; open the site or the dashboard to wake it.
Storage is 1 GB; large photos are downscaled to max 2400 px before upload.
