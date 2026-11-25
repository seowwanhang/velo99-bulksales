# Free Temporary Hosting Guide (RM 0/month — No Credit Card Required)

Deploy **Velo99 Bulksales** 100% free using **Vercel (Hobby Free)** + **Neon PostgreSQL (Free)** + optional **Resend (Free Email Alerts)**.

Because uploaded product photos, hero banners, and your DuitNow QR code are stored directly inside your PostgreSQL database (`UploadedAsset` table → `/api/assets/[id]`), **no extra paid image storage service is required**.

---

## Step 1: Create a Free PostgreSQL Database (Neon — 2 mins)
1. Sign up free at **https://neon.tech** (no credit card required).
2. Click **Create Project** → choose **Singapore (`ap-southeast-1`)** for fastest Malaysian speed.
3. Copy your **Pooled Connection String** (starts with `postgresql://...`).

## Step 2: Switch Prisma to PostgreSQL & Push to GitHub
Run these commands inside `/home/antigravity/velo99-platform`:
```bash
node scripts/set-db-provider.mjs postgresql
git add -A
git commit -m "Configure PostgreSQL for free Vercel deployment"
```
Push the repository to your GitHub account.

## Step 3: Deploy Free on Vercel (2 mins)
1. Sign up free at **https://vercel.com** with GitHub → click **Add New Project** → select your repository.
2. Under **Environment Variables**, add:
   - `DATABASE_URL` = your Neon `postgresql://...` connection string
   - `AUTH_SECRET` = any random 32+ character string (e.g., `openssl rand -hex 32`)
   - `NEXT_PUBLIC_SITE_URL` = your Vercel URL (e.g., `https://velo99-wholesale.vercel.app`)
   - *(Optional — Free Order Alert Emails)* `RESEND_API_KEY` from **https://resend.com** (3,000 free emails/month)
3. Override **Build Command** to:
   ```bash
   npx prisma generate && npx prisma db push && npm run build
   ```
4. Click **Deploy**.

## Step 4: Seed Initial Admin Account (Run Once)
Run once from your terminal with your Neon `DATABASE_URL`:
```bash
DATABASE_URL="postgresql://..." npm run db:seed
```

## Step 5: Go Live in `/admin`
1. Open `https://your-site.vercel.app/admin` and sign in with `admin@velo99.my` / `admin123`.
2. Immediately go to **Dealers & Tiers** → click **Edit** on `admin@velo99.my` → set a strong new password, and deactivate/remove demo accounts.
3. Go to **Site & Delivery Rules** → set your real **Brand Name, Bank Name, Account Number, DuitNow QR upload, WhatsApp Order Number, Order Alert Email, RM Minimum Order Value, Free Delivery m³**, and **Delivery Hubs**.
4. Go to **Products & SKUs** → click **Export CSV Template**, fill in your real bicycle SKUs in Excel/Google Sheets, and click **Import CSV SKUs** to load your entire catalog in seconds!
