// Shared status-config helpers for service orders. Used in dashboards and
// the detail page. Keeps labels/colors in one place.

import type { ServiceOrderStatus } from './types'

export interface OrderStatusDisplay {
  label: string
  badgeClass: string // for rendering pills
  description: string
}

const MAP: Record<ServiceOrderStatus, OrderStatusDisplay> = {
  awaiting_payment: {
    label: 'Awaiting payment',
    badgeClass: 'bg-gray-100 text-gray-700 border-gray-200',
    description: 'Buyer started checkout but has not completed payment yet.',
  },
  in_progress: {
    label: 'In progress',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    description: 'Seller is working on this order.',
  },
  delivered: {
    label: 'Delivered',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    description: 'Seller delivered. Buyer must accept or request a revision.',
  },
  revision_requested: {
    label: 'Revision requested',
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-200',
    description: 'Buyer requested changes. Seller is reworking.',
  },
  completed: {
    label: 'Completed',
    badgeClass: 'bg-green-50 text-green-700 border-green-200',
    description: 'Buyer accepted. Funds released to seller.',
  },
  cancelled: {
    label: 'Cancelled',
    badgeClass: 'bg-gray-100 text-gray-500 border-gray-200',
    description: 'Order was cancelled before delivery.',
  },
  disputed: {
    label: 'Disputed',
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
    description: 'Under review by CodeVault support.',
  },
  refunded: {
    label: 'Refunded',
    badgeClass: 'bg-gray-100 text-gray-500 border-gray-200',
    description: 'Buyer was refunded.',
  },
}

export function orderStatusDisplay(status: ServiceOrderStatus): OrderStatusDisplay {
  return MAP[status] || MAP.awaiting_payment
}
