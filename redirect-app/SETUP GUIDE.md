# NFC Redirect Setup Guide

Cards are programmed with: `go.apextapcards.com/client-name`
When tapped → instantly redirects to the client's Google review page.

---

## Step 1 — Supabase (the database)

1. Go to [supabase.com](https://supabase.com) and open your project
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy everything from `supabase-schema.sql` and paste it in
5. Click **Run**
6. You should see a `redirects` table appear under **Table Editor**

**To grab your Supabase keys:**
- Go to **Project Settings → API**
- Copy **Project URL** and **anon public** key — you'll need these in Step 3

---

## Step 2 — Deploy to Vercel

1. Go to [github.com](https://github.com) and create a new repository called `apex-redirects`
2. Upload the `redirect-app` folder contents to that repo
3. Go to [vercel.com](https://vercel.com) → **Add New Project**
4. Import your `apex-redirects` GitHub repo
5. Click **Deploy** — Vercel handles everything automatically

---

## Step 3 — Add your environment variables to Vercel

1. In Vercel, go to your project → **Settings → Environment Variables**
2. Add these three variables:
   - `NEXT_PUBLIC_SUPABASE_URL` → your Supabase Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → your Supabase anon key
   - `ADMIN_PASSWORD` → pick any password (e.g. `apex2024`) — this is what reps use to log into the admin page
3. Click **Save** then go to **Deployments → Redeploy**

---

## Step 4 — Connect your domain

1. In Vercel → **Settings → Domains**
2. Add `go.apextapcards.com`
3. Vercel will show you a DNS record to add
4. Go to wherever your domain is registered (GoDaddy, Namecheap, etc.)
5. Add that DNS record — takes 5–30 minutes to activate

---

## Adding a new client (sales rep workflow)

This is all a rep needs to do after a sale:

**1. Get the client's Google review link**

Ask the client to log into [google.com/business](https://business.google.com), go to **Read Reviews → Get more reviews**, and share that link with you. Or search the business on Google and copy the review URL.

**2. Open the admin page**

Go to `go.apextapcards.com/admin` on any phone or laptop. Enter the admin password.

**3. Fill in two fields and hit "Add Client"**

- Business name → the URL slug is auto-generated (you can edit it if needed)
- Paste the Google review link

**4. Copy the card URL shown on screen**

The page will display the URL to program, e.g. `go.apextapcards.com/marios-pizza`

**5. Program the cards**

Open **NFC Tools** app → Write → URL → paste the card URL → tap each card to the phone. Done.

**6. Place the cards**

Install at the business. They're live immediately.

---

## How to get a client's Google review link

Best method: ask the business owner to log into [google.com/business](https://business.google.com) → click **Read Reviews** → **Get more reviews** → copy the link. This gives a clean short link.

Alternative: search the business on Google, find the star rating, click **Write a review**, and copy the URL from the browser address bar.
