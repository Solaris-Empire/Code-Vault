// Email templates. Plain TS — no React Email dep to keep the bundle
// lean. Each template returns { subject, html, text }. The HTML uses
// inline styles because most mail clients strip <style> blocks.

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://code-vault-ecru.vercel.app'

const BRAND = '#2563eb' // matches --brand-primary roughly
const FOOTER = `
  <hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb" />
  <p style="color:#9ca3af;font-size:12px;line-height:1.6;text-align:center">
    CodeVault · Solaris Empire Inc.<br/>
    <a href="${SITE_URL}/dashboard/settings" style="color:#9ca3af">Manage notifications</a>
  </p>
`

function layout(bodyHtml: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;background:#ffffff">
    <h1 style="margin:0 0 24px;font-size:20px;font-weight:700;color:#0f172a">
      <a href="${SITE_URL}" style="color:#0f172a;text-decoration:none">CodeVault</a>
    </h1>
    ${bodyHtml}
    ${FOOTER}
  </div>
</body></html>`
}

function money(cents: number, currency = 'USD'): string {
  return `${currency} ${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
}

// ─── order confirmation (buyer) ────────────────────────────────────
export function orderConfirmationTemplate(args: {
  buyerName: string
  productTitle: string
  productSlug: string
  amountCents: number
  licenseKey: string
  orderId: string
}) {
  const { buyerName, productTitle, productSlug, amountCents, licenseKey, orderId } = args
  const subject = `Your CodeVault order — ${productTitle}`
  const downloadUrl = `${SITE_URL}/dashboard/purchases`
  const html = layout(`
    <p>Hi ${escape(buyerName)},</p>
    <p>Thanks for your purchase. Your download and license are ready.</p>
    <div style="border:1px solid #e5e7eb;padding:16px;margin:20px 0">
      <p style="margin:0 0 8px;font-weight:600">${escape(productTitle)}</p>
      <p style="margin:0;color:#64748b;font-size:14px">Amount: ${money(amountCents)}</p>
      <p style="margin:4px 0 0;color:#64748b;font-size:14px">Order: ${escape(orderId)}</p>
    </div>
    <p><strong>License key:</strong> <code style="background:#f1f5f9;padding:2px 6px">${escape(licenseKey)}</code></p>
    <p>
      <a href="${downloadUrl}" style="display:inline-block;background:${BRAND};color:#fff;padding:10px 20px;text-decoration:none;font-weight:600">
        Download now
      </a>
    </p>
    <p style="color:#64748b;font-size:14px">
      Product page: <a href="${SITE_URL}/products/${escape(productSlug)}">${SITE_URL}/products/${escape(productSlug)}</a>
    </p>
  `)
  const text = [
    `Hi ${buyerName},`,
    ``,
    `Thanks for your purchase. Your download and license are ready.`,
    ``,
    `Product: ${productTitle}`,
    `Amount: ${money(amountCents)}`,
    `Order: ${orderId}`,
    `License key: ${licenseKey}`,
    ``,
    `Download: ${downloadUrl}`,
  ].join('\n')
  return { subject, html, text }
}

// ─── new sale (seller) ─────────────────────────────────────────────
export function newSaleTemplate(args: {
  sellerName: string
  productTitle: string
  payoutCents: number
  orderId: string
}) {
  const { sellerName, productTitle, payoutCents, orderId } = args
  const subject = `You made a sale — ${productTitle}`
  const html = layout(`
    <p>Hi ${escape(sellerName)},</p>
    <p>You just sold a copy of <strong>${escape(productTitle)}</strong>.</p>
    <div style="border:1px solid #e5e7eb;padding:16px;margin:20px 0">
      <p style="margin:0 0 8px;font-weight:600">Your payout</p>
      <p style="margin:0;font-size:22px;font-weight:700;color:${BRAND}">${money(payoutCents)}</p>
      <p style="margin:4px 0 0;color:#64748b;font-size:14px">Order: ${escape(orderId)}</p>
    </div>
    <p>Payouts land in your connected Stripe account on the normal payout schedule.</p>
    <p>
      <a href="${SITE_URL}/seller/dashboard" style="display:inline-block;background:${BRAND};color:#fff;padding:10px 20px;text-decoration:none;font-weight:600">
        Open seller dashboard
      </a>
    </p>
  `)
  const text = [
    `Hi ${sellerName},`,
    ``,
    `You sold a copy of ${productTitle}.`,
    `Payout: ${money(payoutCents)}`,
    `Order: ${orderId}`,
    ``,
    `Dashboard: ${SITE_URL}/seller/dashboard`,
  ].join('\n')
  return { subject, html, text }
}

// ─── new job application (employer) ────────────────────────────────
export function newJobApplicationTemplate(args: {
  employerName: string
  jobTitle: string
  jobId: string
  applicantName: string
}) {
  const { employerName, jobTitle, jobId, applicantName } = args
  const subject = `New applicant for ${jobTitle}`
  const url = `${SITE_URL}/jobs/${jobId}/applications`
  const html = layout(`
    <p>Hi ${escape(employerName)},</p>
    <p><strong>${escape(applicantName)}</strong> just applied to your listing:</p>
    <p style="font-size:16px;font-weight:600;margin:16px 0">${escape(jobTitle)}</p>
    <p>
      <a href="${url}" style="display:inline-block;background:${BRAND};color:#fff;padding:10px 20px;text-decoration:none;font-weight:600">
        Review application
      </a>
    </p>
  `)
  const text = [
    `Hi ${employerName},`,
    ``,
    `${applicantName} just applied to your listing: ${jobTitle}`,
    ``,
    `Review: ${url}`,
  ].join('\n')
  return { subject, html, text }
}

// Minimal HTML-escape — templates only substitute user-controlled
// strings (names, titles, slugs) so this is enough to prevent an
// attacker pasting <script> into a product title and having it run
// inside an employer's inbox.
function escape(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
