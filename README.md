# Woof King

Aesthetic bakery pre-order site + internal POS. Built fresh for a Quezon City
bakehouse that sells a short weekly rotation: order by Thursday, bake Friday and
Saturday, collect Sunday.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind v4
- Prisma + SQLite (`prisma/dev.db`) — swap `provider` to `postgresql` for production
- PayMongo / manual GCash / mock payment adapters
- Vitest for domain math

## Quick start

```bash
cd "Woof King"
copy .env.example .env
npm install
npx prisma db push
npm run seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Demo logins

| Role | Email | Password |
| --- | --- | --- |
| Owner | owner@woofking.ph | WoofKing!23 |
| Counter | counter@woofking.ph | Counter!23 |
| Customer | maria@example.com | Customer!23 |

Admin: [http://localhost:3000/admin](http://localhost:3000/admin)

## What you get

**Customer site**

- Nocturne storefront (dark espresso, ember accents, Instrument Serif)
- Cutoff countdown ring + Bake Week strip
- Weekly table of 3–5 products with photos
- Basket drawer, one-page checkout
- Pickup slots or delivery (customer pays the rider; phone required)
- Full payment at checkout (GCash manual, PayMongo card/GCash, or mock)
- Order page with wax-seal code (token-gated)

**Internal POS /admin**

- Today desk, orders board (delivery coordination lane)
- Counter POS (cash / GCash on finished goods)
- Products with photo upload + focal point + live price
- Weekly menu builder (hard 3–5 publish rule, auto dates)
- Ingredients, purchases (any unit → base), recipes, production
- Per-piece cost breakdown (flour ÷ yield)
- Customer book (admin-only)
- Weekly/monthly reports + restock CSV + overhead/VAT

## Payments note (PH)

- **Manual GCash** — launch today, no registration
- **PayMongo test keys** — no paperwork; live needs DTI/SEC + bank
- **QR Ph** — registered merchant only; toggle in settings
- Success redirects never mark paid — webhooks / staff confirm do

## Deploy notes

SQLite + `public/uploads` are local. On Vercel (read-only FS) switch Prisma to
Postgres and put uploads on S3/Cloudinary/Supabase Storage. Set `APP_URL`,
`APP_SECRET`, and PayMongo secrets in the host env.

```bash
npm test
npm run build
```
