import NewProductForm from './new-product-form'

// Force dynamic so the Vercel builder creates a lambda for this route
export const dynamic = 'force-dynamic'

export default function NewProductPage() {
  return <NewProductForm />
}
