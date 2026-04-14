'use client'

import { useState, useEffect } from 'react'
import {
  Users,
  Search,
  Loader2,
  Shield,
  ShoppingBag,
  Store,
  User,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────
interface UserRow {
  id: string
  email: string
  display_name: string | null
  role: string
  created_at: string
  avatar_url: string | null
}

type RoleFilter = 'all' | 'buyer' | 'seller' | 'admin'

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchUsers = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (roleFilter !== 'all') params.set('role', roleFilter)
      if (searchQuery) params.set('search', searchQuery)

      const res = await fetch(`/api/admin/users?${params}`)
      const result = await res.json()
      setUsers(result.data || [])
    } catch {
      // Silent fail
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [roleFilter])

  const handleRoleChange = async (userId: string, newRole: string) => {
    setActionLoading(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (res.ok) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
      }
    } catch {
      // Silent fail
    } finally {
      setActionLoading(null)
    }
  }

  const roleConfig: Record<string, { icon: typeof User; color: string; bg: string }> = {
    admin: { icon: Shield, color: 'text-red-400', bg: 'bg-red-400/10' },
    seller: { icon: Store, color: 'text-(--brand-primary)', bg: 'bg-(--brand-primary)/10' },
    buyer: { icon: ShoppingBag, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">User Management</h1>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex gap-2">
          {(['all', 'buyer', 'seller', 'admin'] as RoleFilter[]).map((role) => (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              className={`px-4 py-2 rounded-none text-sm font-medium transition-colors capitalize ${
                roleFilter === role
                  ? 'bg-(--brand-primary) text-white'
                  : 'bg-(--color-elevated) text-(--color-text-secondary) hover:text-(--color-text-primary)'
              }`}
            >
              {role === 'all' ? 'All Users' : `${role}s`}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); fetchUsers() }}
          className="relative flex-1 max-w-xs"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-(--color-text-muted)" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users..."
            className="w-full bg-(--color-elevated) border border-(--color-border) rounded-none pl-10 pr-4 py-2 text-sm text-(--color-text-primary) placeholder:text-(--color-text-muted) focus:border-(--brand-primary) outline-none"
          />
        </form>
      </div>

      {/* Users table */}
      <div className="bg-(--color-surface) border border-(--color-border) rounded-none overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-(--brand-primary)" />
          </div>
        ) : users.length === 0 ? (
          <div className="py-20 text-center">
            <Users className="h-10 w-10 text-gray-700 mx-auto mb-3" />
            <p className="text-(--color-text-muted)">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-(--color-elevated)">
                <tr>
                  <th className="text-left px-5 py-3 text-(--color-text-secondary) font-medium">User</th>
                  <th className="text-left px-5 py-3 text-(--color-text-secondary) font-medium">Email</th>
                  <th className="text-left px-5 py-3 text-(--color-text-secondary) font-medium">Role</th>
                  <th className="text-left px-5 py-3 text-(--color-text-secondary) font-medium">Joined</th>
                  <th className="text-right px-5 py-3 text-(--color-text-secondary) font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {users.map((user) => {
                  const config = roleConfig[user.role] || roleConfig.buyer
                  const Icon = config.icon
                  const isActioning = actionLoading === user.id

                  return (
                    <tr key={user.id} className="hover:bg-(--color-elevated) transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-(--color-elevated) flex items-center justify-center">
                              <User className="h-4 w-4 text-(--color-text-muted)" />
                            </div>
                          )}
                          <span className="font-medium text-(--color-text-primary)">
                            {user.display_name || 'Anonymous'}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-(--color-text-secondary)">{user.email}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${config.bg} ${config.color}`}>
                          <Icon className="h-3 w-3" />
                          {user.role}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-(--color-text-muted) text-xs">
                        {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          disabled={isActioning}
                          className="bg-(--color-elevated) border border-(--color-border) rounded-none px-3 py-1.5 text-xs text-(--color-text-primary) outline-none focus:border-(--brand-primary) disabled:opacity-50"
                        >
                          <option value="buyer">Buyer</option>
                          <option value="seller">Seller</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
