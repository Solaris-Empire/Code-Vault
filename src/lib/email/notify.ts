// High-level notification helpers. Each one:
//   1. Pulls the context it needs from Supabase using the admin client.
//   2. Checks the recipient's opt-out preferences.
//   3. Builds a template and calls sendEmail() with a stable dedupeKey.
//
// Callers (Stripe webhook, job-apply route) just pass IDs. All of
// these are fire-and-forget — they never throw — so a mail outage
// cannot break a purchase or a job application.

import { getSupabaseAdmin } from '@/lib/supabase/server'
import { captureError } from '@/lib/error-tracking'
import { sendEmail, isEmailKindAllowed } from './client'
import {
  orderConfirmationTemplate,
  newSaleTemplate,
  newJobApplicationTemplate,
} from './templates'

export async function notifyOrderConfirmation(orderId: string) {
  try {
    const admin = getSupabaseAdmin()
    const { data: order } = await admin
      .from('orders')
      .select(`
        id, amount_cents,
        buyer:users!orders_buyer_id_fkey (id, email, display_name),
        product:products!orders_product_id_fkey (title, slug),
        license:licenses!orders_license_id_fkey (license_key)
      `)
      .eq('id', orderId)
      .maybeSingle()

    // Supabase returns embedded FK rows as objects, but the typed helper
    // sometimes widens to arrays — normalize both shapes.
    const buyer = pick(order?.buyer)
    const product = pick(order?.product)
    const license = pick(order?.license)
    if (!order || !buyer?.email || !product || !license) return

    if (!(await isEmailKindAllowed(buyer.id, 'order_confirmation'))) return

    const tpl = orderConfirmationTemplate({
      buyerName: buyer.display_name || 'there',
      productTitle: product.title,
      productSlug: product.slug,
      amountCents: order.amount_cents,
      licenseKey: license.license_key,
      orderId: order.id,
    })
    await sendEmail({
      to: buyer.email,
      toUserId: buyer.id,
      kind: 'order_confirmation',
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      dedupeKey: `order_confirmation:${orderId}`,
    })
  } catch (err) {
    captureError(err instanceof Error ? err : new Error(String(err)), {
      context: 'email:order_confirmation',
      extra: { orderId },
    })
  }
}

export async function notifyNewSale(orderId: string) {
  try {
    const admin = getSupabaseAdmin()
    const { data: order } = await admin
      .from('orders')
      .select(`
        id, seller_payout_cents,
        product:products!orders_product_id_fkey (
          title,
          seller:users!products_seller_id_fkey (id, email, display_name)
        )
      `)
      .eq('id', orderId)
      .maybeSingle()

    const product = pick(order?.product) as
      | {
          title: string
          seller: { id: string; email: string | null; display_name: string | null } | null
        }
      | null
    const seller = pick(product?.seller)
    if (!order || !product || !seller?.email) return

    if (!(await isEmailKindAllowed(seller.id, 'new_sale'))) return

    const tpl = newSaleTemplate({
      sellerName: seller.display_name || 'there',
      productTitle: product.title,
      payoutCents: order.seller_payout_cents,
      orderId: order.id,
    })
    await sendEmail({
      to: seller.email,
      toUserId: seller.id,
      kind: 'new_sale',
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      dedupeKey: `new_sale:${orderId}`,
    })
  } catch (err) {
    captureError(err instanceof Error ? err : new Error(String(err)), {
      context: 'email:new_sale',
      extra: { orderId },
    })
  }
}

export async function notifyNewJobApplication(applicationId: string) {
  try {
    const admin = getSupabaseAdmin()
    const { data: app } = await admin
      .from('job_applications')
      .select(`
        id,
        applicant:users!job_applications_applicant_id_fkey (display_name),
        job:jobs!job_applications_job_id_fkey (
          id, title,
          poster:users!jobs_poster_id_fkey (id, email, display_name)
        )
      `)
      .eq('id', applicationId)
      .maybeSingle()

    const applicant = pick(app?.applicant)
    const job = pick(app?.job) as
      | {
          id: string
          title: string
          poster: { id: string; email: string | null; display_name: string | null } | null
        }
      | null
    const poster = pick(job?.poster)
    if (!app || !job || !poster?.email) return

    if (!(await isEmailKindAllowed(poster.id, 'new_job_application'))) return

    const tpl = newJobApplicationTemplate({
      employerName: poster.display_name || 'there',
      jobTitle: job.title,
      jobId: job.id,
      applicantName: applicant?.display_name || 'A candidate',
    })
    await sendEmail({
      to: poster.email,
      toUserId: poster.id,
      kind: 'new_job_application',
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      dedupeKey: `new_job_application:${applicationId}`,
    })
  } catch (err) {
    captureError(err instanceof Error ? err : new Error(String(err)), {
      context: 'email:new_job_application',
      extra: { applicationId },
    })
  }
}

// Supabase's embedded-FK return shape is `T | T[] | null` depending on
// relationship cardinality — this narrows both to a single object.
function pick<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}
