import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'Terms governing use of CodeVault, the digital code marketplace operated by Solaris Empire Inc.',
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 text-(--color-text-primary)">
      <h1 className="mb-2 text-4xl font-bold">Terms of Service</h1>
      <p className="mb-10 text-sm text-(--color-text-muted)">
        Last updated: April 17, 2026
      </p>

      <div className="prose prose-invert max-w-none space-y-6 text-(--color-text-secondary) [&_h2]:text-(--color-text-primary) [&_a]:text-(--brand-primary)">
        <section>
          <h2 className="mb-2 text-2xl font-semibold">1. Agreement</h2>
          <p>
            By using CodeVault you agree to these Terms of Service. CodeVault is
            operated by Solaris Empire Inc. (&quot;we&quot;, &quot;us&quot;).
            If you do not accept these terms, do not use the service.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-2xl font-semibold">2. Accounts</h2>
          <p>
            You are responsible for the security of your account and for all
            activity under it. You must be at least 13 years old to register.
            Account sharing, resale of accounts, and automated scraping of the
            marketplace are prohibited.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-2xl font-semibold">3. Marketplace transactions</h2>
          <p>
            CodeVault facilitates sales of digital code, scripts, themes, and
            services between independent sellers and buyers. Payments are
            processed by Stripe. CodeVault retains a 15% platform fee on every
            completed sale. Sellers receive the remainder via Stripe Connect
            after any applicable hold or refund period.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-2xl font-semibold">4. Licensing</h2>
          <p>
            Every product is sold under one of the license tiers displayed on
            the product page. Buyers may use the code only within the scope of
            the license purchased. Redistribution of purchased assets is not
            permitted.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-2xl font-semibold">5. Prohibited content</h2>
          <p>
            You may not upload or sell content that infringes third-party
            rights, contains malware, violates applicable law, or is
            misrepresented. We run automated similarity and ownership checks
            and may remove any listing at our discretion.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-2xl font-semibold">6. Refunds</h2>
          <p>
            Digital goods are generally non-refundable once downloaded. We may
            issue refunds at our discretion where a product is materially
            broken, misrepresented, or removed from sale for policy reasons.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-2xl font-semibold">7. Liability</h2>
          <p>
            CodeVault is provided &quot;as is&quot; without warranty of any
            kind. We are not liable for any indirect, incidental, or
            consequential damages arising from use of the service or any
            product purchased on it.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-2xl font-semibold">8. Changes</h2>
          <p>
            We may update these terms from time to time. Continued use of
            CodeVault after a change constitutes acceptance of the revised
            terms.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-2xl font-semibold">9. Contact</h2>
          <p>
            Questions: <a href="mailto:support@codevault.io">support@codevault.io</a>.
          </p>
        </section>
      </div>
    </div>
  )
}
