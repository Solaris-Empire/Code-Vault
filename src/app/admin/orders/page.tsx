'use client'

import { useState, useEffect } from 'react'
import {
  ShoppingCart,
  Loader2,
  DollarSign,
  Search,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────
interface Order {
  id: string
  amount_cents: number
  platform_fee_cents: number
  seller_payout_cents: number
  status: string
  created_at: string
  stripe_payment_id: string | null
  buyer: { display_name: string; email: string } | null
  product: { title: string; slug: string } | null
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/orders')
      .then(res => res.json())
      .then(result => setOrders(result.data || []))
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  // Calculate totals
  const totalRevenue = orders.reduce((sum, o) => sum + (o.amount_cents || 0), 0)
  const totalFees = orders.reduce((sum, o) => sum + (o.platform_fee_cents || 0), 0)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Orders</h1>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-400">
            Total Revenue: <span className="text-white font-semibold">${(totalRevenue / 100).toFixed(2)}</span>
          </span>
          <span className="text-gray-400">
            Platform Fees: <span className="text-violet-400 font-semibold">${(totalFees / 100).toFixed(2)}</span>
          </span>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
          </div>
        ) : orders.length === 0 ? (
          <div className="py-20 text-center">
            <ShoppingCart className="h-10 w-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500">No orders yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="text-left px-5 py-3 text-gray-400 font-medium">Product</th>
                  <th className="text-left px-5 py-3 text-gray-400 font-medium">Buyer</th>
                  <th className="text-right px-5 py-3 text-gray-400 font-medium">Amount</th>
                  <th className="text-right px-5 py-3 text-gray-400 font-medium">Platform Fee</th>
                  <th className="text-right px-5 py-3 text-gray-400 font-medium">Seller Payout</th>
                  <th className="text-left px-5 py-3 text-gray-400 font-medium">Status</th>
                  <th className="text-left px-5 py-3 text-gray-400 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-5 py-4 font-medium text-white">
                      {order.product?.title || 'Unknown'}
                    </td>
                    <td className="px-5 py-4">
                      <div>
                        <p className="text-white text-sm">{order.buyer?.display_name || 'Unknown'}</p>
                        <p className="text-gray-500 text-xs">{order.buyer?.email || ''}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right text-white font-medium">
                      ${(order.amount_cents / 100).toFixed(2)}
                    </td>
                    <td className="px-5 py-4 text-right text-violet-400">
                      ${(order.platform_fee_cents / 100).toFixed(2)}
                    </td>
                    <td className="px-5 py-4 text-right text-green-400">
                      ${(order.seller_payout_cents / 100).toFixed(2)}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        order.status === 'completed'
                          ? 'bg-green-400/10 text-green-400'
                          : 'bg-yellow-400/10 text-yellow-400'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-xs">
                      {new Date(order.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric'
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
