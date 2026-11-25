# Velo99 Bulksales — Full-Stack Online Bicycle Wholesale Platform

A production-ready Next.js + Prisma + SQLite/PostgreSQL online bicycle wholesale platform modeled on [99bulksales.my](https://www.99bulksales.my/), with a built-in **Self-Editable Admin CMS** so you can manage every product, price, banner, delivery hub, FAQ, dealer account, and order yourself after going live.

## Key Features

### Buyer Storefront (`/`)
- **99 Bulksales Experience**: Hero banner carousel, visual category grid, "New in Bulksales" shelf, searchable bulk carton catalog, live **RM 500 Self-Pickup** & **0.50 m³ Free Delivery** progress bars, location/hub selector, daily **1:00 PM cutoff** notice, FAQs accordion, and guest or dealer checkout.
- **B2B Checkout & Invoices**: FPX Online Banking, Visa/Mastercard, **0% 3-Month SME Instalment Plan**, Malaysia **LHDN e-Invoice (TIN)** request, Order History / Guest Order ID lookup, and formal printable A4 invoices at `/invoice/[orderNumber]`.
- **Dealer Tier & Volume Discounts**: Platinum (`15% OFF`, RM 120k limit), Gold (`10% OFF`, RM 60k), Silver (`5% OFF`, RM 30k), Standard (`0% OFF`, RM 12k), plus automatic `+2%` (10+ bikes) / `+3%` (20+ bikes) volume bonuses capped at `20%`.

### Self-Editable Admin CMS & Operations (`/admin`)
- **Overview & Stock Alerts**: `CRITICAL` / `WARNING` / `HEALTHY` stock alert monitoring with top banner and one-click **Quick Restock** PO creation using the automated reorder formula.
- **Products & SKUs**: Add, edit, archive, delete SKUs, upload product photos (`/api/upload`), manage CBM volume, carton packing, list price, cost price (Admin-only), and stock levels.
- **Categories**: Full CRUD + image uploads + display ordering.
- **Orders & Profit Ledger**: Track wholesale orders, update fulfillment status (`CONFIRMED` → `PACKING` → `READY_FOR_PICKUP` / `OUT_FOR_DELIVERY` → `COMPLETED`), print invoices, and review Admin-only COGS, Net Profit, and Margin %.
- **Restock POs & Inventory Logs**: Mark pending Purchase Orders as received to atomically add stock (`INBOUND`) and inspect the complete `inventory_logs` audit trail.
- **Dealers & Tiers**: Create/edit B2B accounts, upgrade dealer tiers, adjust credit limits, and reset passwords.
- **Banners & FAQs**: Edit homepage carousel slides (with photo uploads) and FAQ entries live.
- **Site & Delivery Rules**: Edit brand name, logo badge, phone/email/hours, SSM reg no, cutoff hour, RM minimum order value, Free Delivery `m³` threshold, shipping/reschedule fees, and Peninsular Malaysia delivery regions & pickup hubs.

## Default Seed Accounts
- **Admin CMS (`/admin`)**: `admin@velo99.my` / `admin123` *(change immediately after go-live under Dealers & Tiers)*
- **Gold Dealer (10% OFF)**: `dealer@kvcycles.my` / `dealer123`
- **Platinum Dealer (15% OFF)**: `platinum@penangbikes.my` / `dealer123`
- **Sales Rep**: `sales@velo99.my` / `dealer123`

## Running & Going Live

### 1. Local / VPS Deployment (SQLite)
```bash
npm install
npm run db:setup
npm run build
npm run start
```

### 2. Cloud Production Deployment (Railway / Render / Vercel + PostgreSQL)
1. Copy `.env.example` to `.env` and set a strong random `AUTH_SECRET`.
2. In `prisma/schema.prisma`, change `provider = "sqlite"` to `provider = "postgresql"`.
3. Set `DATABASE_URL` to your PostgreSQL connection string (Neon, Supabase, or Railway Postgres).
4. Run `npm run db:setup && npm run build && npm run start`.
5. Log into `/admin`, change the default admin password, and customize your brand name, banners, hubs, and bicycle SKUs.
