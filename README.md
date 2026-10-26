# My lecture notes

React + Vite front end, Supabase (database, image storage, login) back end, hosted on Vercel. All free tier.

## 1. Create the Supabase project
1. Sign up at https://supabase.com → **New project** (pick a region near you, save the DB password).
2. **SQL Editor → New query**: paste `supabase/schema.sql`, replace `YOUR_EMAIL@example.com` with your email, **Run**.
   This creates the tables, the security rules, the `lecture-images` bucket and 8 sessions per subject.
3. **Authentication → Users → Add user → Create new user**: same email + a strong password, tick *Auto Confirm User*.
4. **Authentication → Sign In / Providers**: turn **off** "Allow new users to sign up".
5. **Project Settings → API Keys**: copy the Project URL and the *publishable* key (or legacy *anon* key).

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

## Privacy
Visitors can read but not edit; writes are rejected by the database unless you're signed in as the owner email.
To make notes private, in `schema.sql` change the three `using (true)` read policies to `using (public.is_owner())`,
re-run it, and make the `lecture-images` bucket private (then switch `getPublicUrl` to `createSignedUrl` in `src/lib/api.ts`).

## Free-tier notes
Supabase pauses free projects after ~1 week with no activity; open the site or the dashboard to wake it.
Storage is 1 GB; large photos are downscaled to max 2400 px before upload.
