import CheckoutSuccessWrapper from './checkout-success-content'

// Force dynamic rendering — this page depends on search params (session_id)
export const dynamic = 'force-dynamic'

export default function CheckoutSuccessPage() {
  return <CheckoutSuccessWrapper />
}
