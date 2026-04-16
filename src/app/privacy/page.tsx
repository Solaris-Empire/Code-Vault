import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How CodeVault collects, uses, and protects your personal information.',
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 text-(--color-text-primary)">
      <h1 className="mb-2 text-4xl font-bold">Privacy Policy</h1>
      <p className="mb-10 text-sm text-(--color-text-muted)">
        Last updated: April 17, 2026
      </p>

      <div className="prose prose-invert max-w-none space-y-6 text-(--color-text-secondary) [&_h2]:text-(--color-text-primary) [&_a]:text-(--brand-primary)">
        <section>
          <h2 className="mb-2 text-2xl font-semibold">1. What we collect</h2>
          <p>
            Account data (email, display name, role), marketplace activity
            (products, orders, reviews, downloads), and technical data
            necessary to run the service (IP, user-agent, device fingerprint
            for fraud prevention).
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-2xl font-semibold">2. Payment data</h2>
          <p>
            Card and bank details are collected and stored by Stripe. CodeVault
            never sees or stores card numbers. We receive a tokenized
            reference, the charge status, and the payout status only.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-2xl font-semibold">3. How we use it</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>To operate the marketplace and settle payouts.</li>
            <li>To detect fraud, theft, and abuse.</li>
            <li>To communicate about your orders, account, and support.</li>
            <li>To improve ranking, search, and recommendations.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-2xl font-semibold">4. Who we share with</h2>
          <p>
            Only with processors that are needed to run the service: Supabase
            (data + auth), Stripe (payments), Vercel (hosting), and Upstash
            (rate-limit state). We do not sell your data.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-2xl font-semibold">5. Retention</h2>
          <p>
            Account data is kept while your account is active. After account
            deletion, transactional records (orders, payouts, tax records) are
            retained for as long as legally required. Rate-limit records and
            abuse logs are kept for up to 90 days.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-2xl font-semibold">6. Your rights</h2>
          <p>
            You may access, correct, export, or delete your personal data by
            contacting <a href="mailto:privacy@codevault.io">privacy@codevault.io</a>.
            EU/UK and California residents have additional rights under GDPR
            and CCPA.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-2xl font-semibold">7. Security</h2>
          <p>
            All traffic is served over HTTPS. Passwords are hashed by Supabase
            Auth. Row-level security policies enforce per-user access on every
            database table. Signed URLs expire after one hour for downloads.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-2xl font-semibold">8. Changes</h2>
          <p>
            We may update this policy. Material changes will be announced on
            the site or by email.
          </p>
        </section>
      </div>
    </div>
  )
}
