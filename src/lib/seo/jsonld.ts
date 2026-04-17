// JSON-LD structured data builders. Google reads these to show rich
// results (price + stars for Product, salary + location + apply link
// for JobPosting, etc). We render them as a <script type="application/ld+json">
// in the page body — Next.js' <Script> wrapper isn't needed because
// search engines happily read inline script blocks.

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://code-vault-ecru.vercel.app'
const SITE_NAME = 'CodeVault'

export function productJsonLd(args: {
  title: string
  slug: string
  description: string
  thumbnailUrl: string | null
  priceCents: number
  priceCurrency?: string
  sellerName: string
  avgRating: number | null
  reviewCount: number
  downloadCount: number
  createdAt: string
}): object {
  const url = `${SITE_URL}/products/${args.slug}`
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: args.title,
    description: args.description,
    image: args.thumbnailUrl ?? undefined,
    url,
    brand: { '@type': 'Brand', name: SITE_NAME },
    sku: args.slug,
    category: 'Software > Digital Goods',
    offers: {
      '@type': 'Offer',
      price: (args.priceCents / 100).toFixed(2),
      priceCurrency: args.priceCurrency ?? 'USD',
      availability: 'https://schema.org/InStock',
      url,
      seller: { '@type': 'Organization', name: args.sellerName },
    },
    ...(args.avgRating && args.reviewCount > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: args.avgRating.toFixed(1),
            reviewCount: args.reviewCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  }
}

export function jobPostingJsonLd(args: {
  id: string
  title: string
  description: string
  employmentType: string
  companyName: string
  companyWebsite: string | null
  remote: boolean
  location: string | null
  salaryMinCents: number | null
  salaryMaxCents: number | null
  salaryCurrency: string
  salaryPeriod: string
  createdAt: string
  expiresAt: string
}): object {
  // Google JobPosting vocab maps our enum onto its own values.
  const EMP_TYPE_MAP: Record<string, string> = {
    full_time:  'FULL_TIME',
    part_time:  'PART_TIME',
    contract:   'CONTRACTOR',
    internship: 'INTERN',
    freelance:  'CONTRACTOR',
  }
  const PERIOD_MAP: Record<string, string> = {
    hour: 'HOUR', day: 'DAY', week: 'WEEK', month: 'MONTH', year: 'YEAR',
  }

  const salaryValue =
    args.salaryMinCents !== null || args.salaryMaxCents !== null
      ? {
          '@type': 'MonetaryAmount',
          currency: args.salaryCurrency,
          value: {
            '@type': 'QuantitativeValue',
            ...(args.salaryMinCents !== null && { minValue: args.salaryMinCents / 100 }),
            ...(args.salaryMaxCents !== null && { maxValue: args.salaryMaxCents / 100 }),
            unitText: PERIOD_MAP[args.salaryPeriod] ?? 'YEAR',
          },
        }
      : undefined

  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: args.title,
    description: args.description,
    datePosted: args.createdAt,
    validThrough: args.expiresAt,
    employmentType: EMP_TYPE_MAP[args.employmentType] ?? 'FULL_TIME',
    hiringOrganization: {
      '@type': 'Organization',
      name: args.companyName,
      ...(args.companyWebsite && { sameAs: args.companyWebsite }),
    },
    ...(args.remote
      ? {
          jobLocationType: 'TELECOMMUTE',
          applicantLocationRequirements: { '@type': 'Country', name: 'Worldwide' },
        }
      : {}),
    ...(args.location && !args.remote
      ? {
          jobLocation: {
            '@type': 'Place',
            address: { '@type': 'PostalAddress', addressLocality: args.location },
          },
        }
      : {}),
    ...(salaryValue ? { baseSalary: salaryValue } : {}),
    url: `${SITE_URL}/jobs/${args.id}`,
    directApply: true,
  }
}

export function jsonLdScript(data: object): string {
  return JSON.stringify(data).replaceAll('</', '<\\/')
}
