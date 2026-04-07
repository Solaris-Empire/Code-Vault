# UK Grocery Store - Technical Documentation

**Version:** 1.0
**Date:** April 2026
**Classification:** Client Confidential

---

## 1. Executive Summary

The UK Grocery Store is an enterprise-grade, multi-vendor e-commerce platform purpose-built for the UK grocery market. The platform supports three distinct user portals — Customer Storefront, Vendor Portal, and Administration Dashboard — delivering a complete marketplace solution with real-time order management, secure payment processing, and intelligent automation.

---

## 2. Platform Architecture

### 2.1 Architecture Overview

The platform follows a modern server-side rendered (SSR) architecture with the following layers:

| Layer | Description |
|-------|-------------|
| **Presentation** | Server-rendered React application with client-side hydration |
| **API Layer** | RESTful API endpoints with request validation and rate limiting |
| **Business Logic** | Server-side actions, automation engines, and workflow processors |
| **Data Layer** | Managed PostgreSQL database with row-level security policies |
| **Caching Layer** | Distributed key-value caching for high-frequency data |
| **Queue Layer** | Asynchronous job processing for background tasks |

### 2.2 Technology Summary

| Concern | Solution |
|---------|----------|
| Frontend Framework | React 19 with TypeScript (strict mode) |
| Server Framework | Next.js 16 (App Router, Server Components, Server Actions) |
| Database | Managed PostgreSQL with 35+ tables and enforced row-level security |
| Authentication | Managed auth service with email/password, social login, and magic link support |
| Payments | PCI-compliant payment gateway with marketplace split-payment capabilities |
| Email Delivery | Transactional email service with templating and delivery tracking |
| AI Chatbot | Large language model integration for intent-based customer support |
| Error Monitoring | Real-time error tracking and alerting in production |
| Caching | Distributed Redis-compatible key-value store |
| Hosting | Edge-optimised serverless deployment platform |

### 2.3 Security Architecture

- **Row-Level Security (RLS):** Every database table is protected by security policies ensuring users can only access their own data.
- **CSRF Protection:** All state-changing requests are protected against cross-site request forgery.
- **XSS Sanitisation:** All user-generated content is sanitised before rendering.
- **Rate Limiting:** API endpoints are rate-limited to prevent abuse.
- **Request Validation:** All incoming data is validated against strict schemas before processing.
- **Audit Logging:** All administrative actions are recorded with full traceability.
- **Fraud Detection:** Automated fraud checks on orders and payment attempts.
- **Security Headers:** HSTS, Content-Security-Policy, X-Frame-Options, and other HTTP security headers enforced.
- **Encryption:** All data in transit uses TLS 1.3. Data at rest is encrypted at the database level.

---

## 3. Portal Specifications

### 3.1 Customer Storefront

The public-facing shopping experience, accessible to all users.

**Product Discovery**
- Full-text product search with filters (category, brand, price range, dietary tags)
- Hierarchical category browsing
- Brand-based filtering and browsing
- Product comparison (side-by-side feature comparison)
- Recently viewed products (persisted client-side)
- Price alert subscriptions (notify when price drops)
- Stock alert subscriptions (notify when back in stock)

**Shopping Experience**
- Persistent shopping cart with real-time stock validation
- Multi-vendor cart support (items from different vendors in one checkout)
- Coupon and discount code application
- Multi-buy offer detection and automatic application
- Gift card purchase and redemption
- Wishlist management

**Checkout and Payment**
- Secure, PCI-compliant hosted checkout
- Order summary with itemised pricing
- Delivery slot selection with real-time availability
- Multiple delivery address management
- Store credit and loyalty points redemption at checkout
- Order confirmation with email receipt

**Post-Purchase**
- Real-time order tracking (pending, confirmed, processing, ready, out for delivery, delivered)
- Order history with reorder functionality
- Returns and refund requests (RMA workflow)
- Product review and rating submission
- Product Q&A participation
- Invoice download

**Customer Support**
- AI-powered chatbot with intent recognition and FAQ integration
- Live chat with support agents
- Support ticket system with category-based routing
- Email-based support communication

**Loyalty and Rewards**
- Tiered loyalty programme (points earned on every purchase)
- Points redemption against future orders
- Referral programme with incentive rewards
- Personalised reorder reminders

**Account Management**
- Secure email/password authentication with email verification
- Profile management
- Delivery address book
- Notification preferences (email, push, in-app)
- Order and returns history

### 3.2 Vendor Portal

A dedicated dashboard for marketplace vendors to manage their business.

**Onboarding**
- Self-service vendor application form
- KYC document submission
- Application review workflow (admin approval required)
- Guided setup for store profile and payment details

**Product Management**
- Product creation with rich media, pricing, and stock levels
- Bulk product import/export (CSV and Excel)
- Category and tag assignment
- Stock level management with low-stock alerts
- Price history tracking

**Order Fulfilment**
- Real-time order notifications
- Order status management (confirm, process, mark ready, dispatch)
- Per-vendor order view (only their items from multi-vendor orders)
- Packing slip and invoice generation

**Financial Management**
- Payout dashboard with earnings breakdown
- Commission tracking (platform commission deducted automatically)
- Payout history and status tracking
- Connected payment account management

**Customer Engagement**
- Live chat with customers (per-order messaging)
- Review management and response
- Vendor-specific coupon and discount creation
- Flash deal creation and scheduling
- Gift card issuance

**Analytics**
- Sales performance dashboard
- Order volume and revenue metrics
- Product performance insights
- Customer review summary and ratings
- Stock alert monitoring

**Store Settings**
- Store profile (name, description, logo, banner)
- Business information management
- Notification preferences

### 3.3 Administration Dashboard

Full platform control for site administrators.

**Dashboard and Analytics**
- Key performance indicators (orders, revenue, active users, conversion rate)
- Sales trend visualisation
- Vendor performance overview
- Advanced analytics with custom date ranges

**Product and Catalogue Management**
- Full product CRUD with approval workflow for vendor submissions
- Category hierarchy management (create, reorder, nest)
- Brand management
- Bulk import/export (CSV and Excel)

**Order Management**
- All-orders view with advanced filtering
- Order status management
- Refund and cancellation processing
- Invoice generation and tracking

**Vendor Management**
- Vendor application review and approval
- Vendor verification status management
- Commission rate configuration (global and per-vendor)
- Vendor performance monitoring and scoring
- Vendor account suspension/activation

**Customer Management**
- User directory with search and filtering
- Account status management
- Customer order history view
- Store credit issuance

**Marketing and Engagement**
- Coupon and discount code creation (percentage, fixed, free delivery)
- Flash deal scheduling with countdown timers
- Multi-buy offer configuration
- Newsletter campaign management with delivery tracking and link analytics
- Abandoned cart recovery automation (configurable email sequences)
- Gift card design and issuance

**Loyalty Programme Administration**
- Loyalty tier configuration
- Points earning rule management
- Points redemption rule management
- Referral programme settings

**Delivery Management**
- Delivery slot creation and scheduling
- Delivery zone configuration
- Slot capacity management
- Recurring slot templates

**Support Operations**
- Support ticket queue with assignment and priority
- Ticket categorisation and tagging
- Internal notes on tickets
- Canned response library
- AI chatbot intent and FAQ management
- Chatbot training phrase configuration

**Returns Management**
- Return request queue
- Return status workflow (requested, approved, received, refunded)
- Per-item return tracking

**Content Management**
- Homepage hero carousel management
- Email template customisation
- Site settings (store name, currency, contact details)

**Operations and Compliance**
- Team member and staff account management
- Role-based access control
- Full audit log with filtering (who did what, when)
- Fraud check records
- Data backup logs
- Health monitoring endpoint

---

## 4. Database Schema Overview

The platform operates on **35+ database tables** organised into the following domains:

| Domain | Tables | Description |
|--------|--------|-------------|
| **Users and Auth** | profiles, addresses | User accounts extending the auth system, delivery addresses |
| **Catalogue** | products, categories, product_categories | Product data, hierarchical categories, many-to-many relationships |
| **Shopping** | carts, cart_items, orders, order_items | Cart sessions, order records, line items |
| **Vendors** | vendors, vendor_applications, vendor_orders, vendor_payouts, vendor_metrics | Vendor profiles, applications, order splits, payouts, performance |
| **Payments** | invoices, invoice_items, payment_attempts, store_credits, credit_transactions | Invoicing, payment tracking, store credit system |
| **Customer Engagement** | wishlists, wishlist_items, product_reviews, review_votes, product_questions, product_answers, recently_viewed, price_alerts, stock_alerts | Wishlists, reviews, Q&A, alerts |
| **Communication** | chat_conversations, chat_messages, support_tickets, ticket_messages, ticket_categories, ticket_tags | Live chat, support tickets |
| **AI Chatbot** | chatbot_intents, chatbot_training_phrases, chatbot_responses, chatbot_faqs, chatbot_conversations, chatbot_settings | Intent management, training data, FAQ database |
| **Marketing** | coupons, coupon_usage, flash_deals, multibuy_offers, product_discounts, newsletter_subscribers, newsletter_campaigns, campaign_send_logs, campaign_links, link_click_logs | Promotions, newsletters, analytics |
| **Loyalty** | loyalty_accounts, loyalty_tiers, loyalty_points, points_earning_rules, points_redemption_rules, points_transactions, referral_codes, referrals | Points, tiers, referrals |
| **Delivery** | delivery_slots, delivery_slot_templates, delivery_slot_reservations, delivery_zones | Scheduling, zones, capacity |
| **Returns** | returns, return_items, return_status_history | RMA workflow |
| **Gift Cards** | gift_cards, gift_card_designs, gift_card_transactions | Gift card lifecycle |
| **Operations** | hero_slides, store_settings, site_settings, email_templates, audit_logs, fraud_checks, backup_logs, team_members, notifications, notification_preferences, push_subscriptions, abandoned_carts, cart_recovery_emails, cart_recovery_settings, import_export_jobs | Content, config, compliance, notifications |

All tables enforce **Row-Level Security (RLS)** policies and are indexed for optimal query performance.

---

## 5. API Specification

The platform exposes **40+ RESTful API endpoints** across the following domains:

| Domain | Endpoints | Auth Required |
|--------|-----------|---------------|
| **Authentication** | `/api/auth/*` | Partial |
| **Products** | `/api/products/*` | No (read), Yes (write) |
| **Categories** | `/api/categories/*` | No (read), Yes (write) |
| **Cart** | `/api/cart/*` | Yes |
| **Checkout** | `/api/checkout/*` | Yes |
| **Orders** | `/api/orders/*` | Yes |
| **Reviews** | `/api/reviews/*` | No (read), Yes (write) |
| **Search** | `/api/search/*` | No |
| **Vendors** | `/api/vendor/*` | Yes (vendor role) |
| **Stores** | `/api/stores/*` | No (read), Yes (write) |
| **Chat** | `/api/chat/*` | Yes |
| **Tickets** | `/api/tickets/*` | Yes |
| **Delivery** | `/api/delivery/*` | Partial |
| **Coupons** | `/api/coupons/*` | Partial |
| **Deals** | `/api/deals/*` | Partial |
| **Gift Cards** | `/api/gift-cards/*` | Partial |
| **Loyalty** | `/api/loyalty/*` | Yes |
| **Referrals** | `/api/referrals/*` | Yes |
| **Wishlist** | `/api/wishlist/*` | Yes |
| **Stock Alerts** | `/api/stock-alerts/*` | Yes |
| **Notifications** | `/api/notifications/*` | Yes |
| **Newsletter** | `/api/newsletter/*` | Partial |
| **Returns** | `/api/returns/*` | Yes |
| **Admin** | `/api/admin/*` | Yes (admin role) |
| **Webhooks** | `/api/webhooks/*` | Signature verified |
| **Cron Jobs** | `/api/cron/*` | Secret key |
| **Health** | `/api/health` | No |

All endpoints implement:
- Request body validation via schema enforcement
- Role-based access control
- Rate limiting
- Structured error responses

---

## 6. Automation Systems

The platform includes several automated background processes:

| System | Trigger | Action |
|--------|---------|--------|
| **Abandoned Cart Recovery** | Cart inactive for configurable duration | Sends sequenced recovery emails |
| **Fraud Detection** | New order placed | Runs automated risk scoring checks |
| **Loyalty Points** | Order completed | Awards points based on earning rules |
| **Price Alerts** | Product price updated | Notifies subscribed users |
| **Stock Alerts** | Product restocked | Notifies subscribed users |
| **Reorder Reminders** | Configurable interval after last order | Sends reminder email to customers |
| **Vendor Scoring** | Periodic | Recalculates vendor performance scores |
| **Newsletter Campaigns** | Scheduled by admin | Sends bulk email with tracking |

---

## 7. Performance and Scalability

- **Server-Side Rendering (SSR):** Pages are rendered on the server for fast initial load and SEO optimisation.
- **Incremental Static Regeneration (ISR):** High-traffic pages are statically generated and revalidated periodically.
- **Edge Deployment:** The application is deployed to a global edge network for low-latency access.
- **Distributed Caching:** Frequently accessed data is cached in a distributed key-value store.
- **Database Indexing:** All query-heavy columns are indexed for sub-millisecond lookups.
- **Code Splitting:** JavaScript bundles are automatically split per-route for minimal load times.
- **Image Optimisation:** All product images are automatically resized, compressed, and served in modern formats.
- **Asynchronous Processing:** Heavy operations (emails, analytics, scoring) are offloaded to background queues.

---

## 8. Testing and Quality Assurance

| Test Type | Coverage |
|-----------|----------|
| **Unit Tests** | Core business logic, utilities, validation schemas |
| **Integration Tests** | API endpoints, database operations, auth flows |
| **End-to-End Tests** | Critical user journeys (signup, browse, cart, checkout, order tracking) |
| **Load Tests** | API throughput and response time under simulated traffic |
| **Type Safety** | Full TypeScript strict mode across the entire codebase |
| **Linting** | Automated code quality checks on every change |

---

## 9. Deployment and Infrastructure

| Concern | Approach |
|---------|----------|
| **Hosting** | Serverless edge deployment with automatic scaling |
| **Database** | Managed PostgreSQL with automated backups and point-in-time recovery |
| **CDN** | Global content delivery network for static assets |
| **SSL/TLS** | Automatic certificate provisioning and renewal |
| **CI/CD** | Automatic deployment on code push to main branch |
| **Monitoring** | Real-time error tracking, alerting, and performance metrics |
| **Uptime** | 99.9% SLA on hosting and database infrastructure |

---

## 10. Compliance and Data Protection

- **GDPR Compliant:** User data handling follows UK GDPR requirements.
- **PCI DSS:** Payment processing is handled by a PCI Level 1 compliant payment provider. No card data touches the application servers.
- **Data Encryption:** TLS 1.3 in transit, AES-256 at rest.
- **Audit Trail:** All administrative and sensitive operations are logged with timestamps and user attribution.
- **Data Minimisation:** Only necessary data is collected and retained.
- **Right to Erasure:** User account deletion capabilities built in.

---

## 11. Order Lifecycle

```
[Order Placed]
     |
[Payment Confirmed]
     |
[Order Confirmed] --> Vendor notified
     |
[Processing] --> Vendor preparing items
     |
[Ready for Delivery]
     |
[Out for Delivery] --> Customer notified with tracking
     |
[Delivered] --> Loyalty points awarded
     |
[Review Requested] --> Follow-up email sent
```

**Returns Flow:**
```
[Return Requested] --> Customer submits reason
     |
[Return Approved] --> Admin/vendor reviews
     |
[Item Received] --> Warehouse confirms receipt
     |
[Refund Processed] --> Funds returned to original payment method
```

---

## 12. Supported User Roles

| Role | Access Level |
|------|-------------|
| **Customer** | Storefront, account area, orders, support |
| **Vendor** | Vendor portal, own products/orders/payouts |
| **Admin** | Full administration dashboard |
| **Super Admin** | All admin privileges plus team and system settings |

---

*This document describes the technical capabilities of the UK Grocery Store platform as of April 2026. For questions or clarification, please contact the development team.*
