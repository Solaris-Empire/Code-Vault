import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description: 'How CodeVault uses cookies and similar technologies.',
}

export default function CookiesPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 text-(--color-text-primary)">
      <h1 className="mb-2 text-4xl font-bold">Cookie Policy</h1>
      <p className="mb-10 text-sm text-(--color-text-muted)">
        Last updated: April 17, 2026
      </p>

      <div className="prose prose-invert max-w-none space-y-6 text-(--color-text-secondary) [&_h2]:text-(--color-text-primary) [&_a]:text-(--brand-primary)">
        <section>
          <h2 className="mb-2 text-2xl font-semibold">What we use</h2>
          <p>
            CodeVault only sets strictly-necessary cookies. We do not run
            third-party advertising or behavioural-tracking cookies.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-2xl font-semibold">Cookies we set</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Auth session</strong> — set by Supabase Auth. Keeps you
              signed in.
            </li>
            <li>
              <strong>csrf_token</strong> — double-submit cookie used to block
              cross-site request forgery on state-changing API calls.
            </li>
            <li>
              <strong>Preference cookies</strong> — remember UI choices like
              theme and recently-viewed categories.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-2xl font-semibold">Third-party cookies</h2>
          <p>
            Stripe may set cookies on checkout pages it hosts to run fraud
            detection. These cookies are governed by Stripe&apos;s policy.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-2xl font-semibold">Controlling cookies</h2>
          <p>
            You can clear cookies or block them in your browser settings.
            Blocking the auth or CSRF cookie will sign you out and prevent
            most actions on the site.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-2xl font-semibold">Contact</h2>
          <p>
            Questions: <a href="mailto:privacy@codevault.io">privacy@codevault.io</a>.
          </p>
        </section>
      </div>
    </div>
  )
}
