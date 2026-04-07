# CLAUDE.md — CodeVault Project Instructions

## Project Overview
**CodeVault** is a digital code marketplace (CodeCanyon competitor) built by Solaris Empire Inc.
Developers upload scripts/code/templates, buyers purchase and download them.
Revenue model: Commission on every sale (15% platform fee).

## Tech Stack
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript (strict mode, NO `any`)
- **Database**: Supabase (PostgreSQL + Auth + Storage)
- **Payments**: Stripe Connect (split payments between platform + sellers)
- **Styling**: Tailwind CSS
- **Validation**: Zod on every API boundary
- **Hosting**: Vercel

## Architecture Rules
- Follow Solaris Empire engineering standards
- Data flow: Route → Component → Hook → Service → Repository → Database
- Components NEVER touch the database directly
- Services contain ALL business logic
- Every async call has try/catch error handling
- Every API returns: `{ data: {...}, meta: {...} }` or `{ error: {...} }`

## Database Tables (Supabase)
```
users           — id, email, display_name, role (buyer|seller|admin), avatar_url, bio, created_at, updated_at
products        — id, seller_id, title, slug, description, short_description, price_cents, category_id, demo_url, thumbnail_url, status (draft|pending|approved|rejected), download_count, created_at, updated_at
product_files   — id, product_id, file_url, file_name, file_size_bytes, version, changelog, created_at
categories      — id, name, slug, description, icon, parent_id, sort_order
licenses        — id, product_id, buyer_id, license_key, license_type (regular|extended), expires_at, created_at
orders          — id, buyer_id, product_id, license_id, amount_cents, platform_fee_cents, seller_payout_cents, stripe_payment_id, status, created_at
reviews         — id, product_id, buyer_id, rating, comment, created_at, updated_at
payouts         — id, seller_id, amount_cents, stripe_payout_id, status, created_at
```

## Key Features to Build
1. **Auth** — Supabase Auth (email + Google OAuth)
2. **Seller Dashboard** — Upload products, manage listings, view sales/analytics
3. **Buyer Experience** — Browse, search, purchase, download
4. **Admin Panel** — Review/approve products, manage users, view platform stats
5. **Digital Downloads** — Secure file upload to Supabase Storage, signed download URLs
6. **License System** — Generate unique keys per purchase, regular vs extended
7. **Stripe Connect** — Split payments (85% seller, 15% platform)
8. **Reviews & Ratings** — Buyers rate purchased products
9. **Version Management** — Sellers push updates, buyers get notified
10. **Search & Categories** — PHP, JavaScript, React, WordPress, HTML, Mobile, Full Apps

## Categories
- PHP Scripts
- JavaScript
- React & Next.js
- Vue.js
- WordPress Plugins
- WordPress Themes
- HTML Templates
- Mobile Apps (Flutter/React Native)
- Full Applications
- UI Kits & Components
- API & Backend
- Database & Tools

## Naming Conventions
- Files/folders: kebab-case (user-profile.tsx)
- Variables/functions: camelCase (userName, handleSubmit)
- Components: PascalCase (ProductCard, SellerDashboard)
- DB tables/columns: snake_case (product_files, seller_id)
- API routes: kebab-case plural (/api/v1/products)
- Constants: UPPER_SNAKE_CASE (PLATFORM_FEE_PERCENT)

## Commission Logic
```
PLATFORM_FEE_PERCENT = 15
sellerPayout = priceCents * (100 - PLATFORM_FEE_PERCENT) / 100
platformFee = priceCents - sellerPayout
```

## Security Rules
- Zod validation on EVERY API input
- Auth check on EVERY non-public endpoint
- RLS enabled on EVERY Supabase table
- Signed URLs for file downloads (expire after 1 hour)
- Rate limiting on auth + purchase endpoints
- Never expose internal errors to clients

## Git Commit Format
```
type(scope): description [CV-ticket]
Example: feat(products): add file upload to Supabase Storage [CV-001]
```

## Priority Build Order
1. Auth + user roles (buyer/seller/admin)
2. Categories + product listing pages
3. Seller dashboard + product upload
4. Digital file upload + storage
5. Stripe Connect + checkout
6. License key generation
7. Download system (signed URLs)
8. Reviews & ratings
9. Admin review/approval panel
10. Version management + changelog
11. Search + filtering
12. Seller analytics + payouts

## Owner
Kevin Baptist — Founder & CEO, Solaris Empire Inc.
Kevin is early in his coding journey. Write complete working code with comments explaining WHY. Never skip steps. Be his technical co-founder.
