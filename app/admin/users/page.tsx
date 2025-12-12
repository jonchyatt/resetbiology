"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Users, Shield, Clock, Crown, UserPlus, RefreshCw, Search, AlertCircle, CheckCircle, Gift, CalendarClock, X } from 'lucide-react'

interface User {
  id: string
  email: string
  name: string | null
  memberID: string | null
  role: string
  accessLevel: string
  subscriptionStatus: string | null
  subscriptionExpiry: string | null
  introductionStartDate: string | null
  introductionExpiresAt: string | null
  createdAt: string
  updatedAt: string
}

const ACCESS_LEVELS = [
  { value: 'guest', label: 'Guest', color: 'gray', description: 'No access' },
  { value: 'introduction', label: 'Introduction', color: 'blue', description: '7-day trial' },
  { value: 'subscriber', label: 'Subscriber', color: 'green', description: 'Full access' },
  { value: 'admin', label: 'Admin', color: 'purple', description: 'Full + Admin' },
]

const EXPIRY_FILTERS = [
  { value: 'all', label: 'All Users' },
  { value: 'expiring_7', label: 'Expiring in 7 days' },
  { value: 'expiring_14', label: 'Expiring in 14 days' },
  { value: 'expiring_30', label: 'Expiring in 30 days' },
  { value: 'expired', label: 'Expired' },
  { value: 'active', label: 'Active Subscribers' },
]

const GRANT_DAYS_OPTIONS = [7, 14, 30, 60, 90, 180, 365]

function getAccessLevelColor(level: string): string {
  switch (level) {
    case 'admin': return 'text-purple-400 bg-purple-400/20 border-purple-400/30'
    case 'subscriber': return 'text-green-400 bg-green-400/20 border-green-400/30'
    case 'introduction': return 'text-blue-400 bg-blue-400/20 border-blue-400/30'
    default: return 'text-gray-400 bg-gray-400/20 border-gray-400/30'
  }
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function getDaysRemaining(expiryDate: string | null): string | null {
  if (!expiryDate) return null
  const diff = new Date(expiryDate).getTime() - new Date().getTime()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  if (days < 0) return 'Expired'
  if (days === 0) return 'Today'
  return `${days} days`
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterLevel, setFilterLevel] = useState<string>('all')
  const [updating, setUpdating] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // New admin form
  const [showNewAdmin, setShowNewAdmin] = useState(false)
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [newAdminName, setNewAdminName] = useState('')
  const [creating, setCreating] = useState(false)

  // Grant time modal
  const [grantTimeUser, setGrantTimeUser] = useState<User | null>(null)
  const [grantDays, setGrantDays] = useState(30)
  const [customDate, setCustomDate] = useState('')
  const [grantMode, setGrantMode] = useState<'days' | 'date'>('days')
  const [granting, setGranting] = useState(false)

  // Expiry filter
  const [expiryFilter, setExpiryFilter] = useState('all')

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/users')
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch users')
      }
      const data = await res.json()
      setUsers(data.users)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const updateUserAccess = async (userId: string, accessLevel: string) => {
    setUpdating(userId)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, accessLevel })
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update user')
      }
      const data = await res.json()
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...data.user } : u))
      setMessage({ type: 'success', text: `Updated ${data.user.email} to ${accessLevel}` })
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update' })
    } finally {
      setUpdating(null)
    }
  }

  const createAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAdminEmail) return

    setCreating(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newAdminEmail, name: newAdminName })
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create admin')
      }
      const data = await res.json()
      setMessage({ type: 'success', text: data.message })
      setNewAdminEmail('')
      setNewAdminName('')
      setShowNewAdmin(false)
      fetchUsers() // Refresh list
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to create admin' })
    } finally {
      setCreating(false)
    }
  }

  const grantFreeTime = async () => {
    if (!grantTimeUser) return

    setGranting(true)
    setMessage(null)
    try {
      const body: Record<string, unknown> = { userId: grantTimeUser.id }

      if (grantMode === 'days') {
        body.grantDays = grantDays
      } else if (customDate) {
        body.setSubscriberUntil = customDate
      } else {
        throw new Error('Please select a date')
      }

      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to grant time')
      }
      const data = await res.json()
      setUsers(prev => prev.map(u => u.id === grantTimeUser.id ? { ...u, ...data.user } : u))

      const expiryDate = data.user.subscriptionExpiry
        ? new Date(data.user.subscriptionExpiry).toLocaleDateString()
        : 'N/A'
      setMessage({
        type: 'success',
        text: `Granted subscription time to ${grantTimeUser.email}. Expires: ${expiryDate}`
      })
      setGrantTimeUser(null)
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to grant time' })
    } finally {
      setGranting(false)
    }
  }

  // Helper to check if subscription is expiring within X days
  const isExpiringWithin = (user: User, days: number): boolean => {
    const expiry = user.subscriptionExpiry || user.introductionExpiresAt
    if (!expiry) return false
    const expiryDate = new Date(expiry)
    const now = new Date()
    const diff = expiryDate.getTime() - now.getTime()
    const daysRemaining = diff / (1000 * 60 * 60 * 24)
    return daysRemaining > 0 && daysRemaining <= days
  }

  const isExpired = (user: User): boolean => {
    const expiry = user.subscriptionExpiry || user.introductionExpiresAt
    if (!expiry) return false
    return new Date(expiry) < new Date()
  }

  const isActiveSubscriber = (user: User): boolean => {
    if (user.accessLevel === 'admin') return false
    if (user.accessLevel !== 'subscriber' && user.accessLevel !== 'introduction') return false
    const expiry = user.subscriptionExpiry || user.introductionExpiresAt
    if (!expiry) return user.subscriptionStatus === 'active'
    return new Date(expiry) > new Date()
  }

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = searchTerm === '' ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.memberID?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesAccessLevel = filterLevel === 'all' || user.accessLevel === filterLevel

    // Expiry filter
    let matchesExpiryFilter = true
    if (expiryFilter === 'expiring_7') {
      matchesExpiryFilter = isExpiringWithin(user, 7)
    } else if (expiryFilter === 'expiring_14') {
      matchesExpiryFilter = isExpiringWithin(user, 14)
    } else if (expiryFilter === 'expiring_30') {
      matchesExpiryFilter = isExpiringWithin(user, 30)
    } else if (expiryFilter === 'expired') {
      matchesExpiryFilter = isExpired(user)
    } else if (expiryFilter === 'active') {
      matchesExpiryFilter = isActiveSubscriber(user)
    }

    return matchesSearch && matchesAccessLevel && matchesExpiryFilter
  })

  // Stats
  const stats = {
    total: users.length,
    admins: users.filter(u => u.accessLevel === 'admin').length,
    subscribers: users.filter(u => u.accessLevel === 'subscriber').length,
    introduction: users.filter(u => u.accessLevel === 'introduction').length,
    guests: users.filter(u => u.accessLevel === 'guest').length,
    expiring7: users.filter(u => isExpiringWithin(u, 7)).length,
    expiring30: users.filter(u => isExpiringWithin(u, 30)).length,
    expired: users.filter(u => isExpired(u)).length,
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative"
         style={{
           backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
           backgroundSize: 'cover',
           backgroundPosition: 'center',
           backgroundAttachment: 'fixed'
         }}>
      <div className="relative z-10">
        {/* Header */}
        <div className="text-center py-8">
          <div className="mb-4">
            <Link href="/admin" className="inline-flex items-center text-primary-300 hover:text-primary-200 font-medium text-sm transition-colors">
              ← Back to Admin Dashboard
            </Link>
          </div>
          <div className="flex items-center justify-center mb-4">
            <Users className="w-10 h-10 text-primary-400 mr-3" />
            <h1 className="text-4xl font-bold text-white">User Management</h1>
          </div>
          <p className="text-gray-300 max-w-2xl mx-auto">
            View and manage user access levels. Grant admin privileges or adjust subscription tiers.
          </p>
        </div>

        {/* Stats */}
        <div className="container mx-auto px-4 mb-6">
          <div className="max-w-6xl mx-auto space-y-4">
            {/* User Types Row */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-sm rounded-xl p-4 border border-gray-400/20 text-center">
                <div className="text-2xl font-bold text-white">{stats.total}</div>
                <div className="text-sm text-gray-400">Total Users</div>
              </div>
              <div className="bg-gradient-to-br from-purple-800/30 to-purple-900/30 backdrop-blur-sm rounded-xl p-4 border border-purple-400/20 text-center">
                <div className="text-2xl font-bold text-purple-400">{stats.admins}</div>
                <div className="text-sm text-gray-400">Admins</div>
              </div>
              <div className="bg-gradient-to-br from-green-800/30 to-green-900/30 backdrop-blur-sm rounded-xl p-4 border border-green-400/20 text-center">
                <div className="text-2xl font-bold text-green-400">{stats.subscribers}</div>
                <div className="text-sm text-gray-400">Subscribers</div>
              </div>
              <div className="bg-gradient-to-br from-blue-800/30 to-blue-900/30 backdrop-blur-sm rounded-xl p-4 border border-blue-400/20 text-center">
                <div className="text-2xl font-bold text-blue-400">{stats.introduction}</div>
                <div className="text-sm text-gray-400">Introduction</div>
              </div>
              <div className="bg-gradient-to-br from-gray-800/30 to-gray-900/30 backdrop-blur-sm rounded-xl p-4 border border-gray-400/20 text-center">
                <div className="text-2xl font-bold text-gray-400">{stats.guests}</div>
                <div className="text-sm text-gray-400">Guests</div>
              </div>
            </div>

            {/* Subscription Status Row */}
            <div className="grid grid-cols-3 gap-4">
              <button
                onClick={() => setExpiryFilter(expiryFilter === 'expiring_7' ? 'all' : 'expiring_7')}
                className={`bg-gradient-to-br backdrop-blur-sm rounded-xl p-4 border text-center transition-all hover:scale-[1.02] cursor-pointer ${
                  expiryFilter === 'expiring_7'
                    ? 'from-orange-600/40 to-orange-700/40 border-orange-400/50 ring-2 ring-orange-400/50'
                    : 'from-orange-800/30 to-orange-900/30 border-orange-400/20'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <CalendarClock className="w-5 h-5 text-orange-400" />
                  <div className="text-2xl font-bold text-orange-400">{stats.expiring7}</div>
                </div>
                <div className="text-sm text-gray-400">Expiring in 7 Days</div>
              </button>
              <button
                onClick={() => setExpiryFilter(expiryFilter === 'expiring_30' ? 'all' : 'expiring_30')}
                className={`bg-gradient-to-br backdrop-blur-sm rounded-xl p-4 border text-center transition-all hover:scale-[1.02] cursor-pointer ${
                  expiryFilter === 'expiring_30'
                    ? 'from-yellow-600/40 to-yellow-700/40 border-yellow-400/50 ring-2 ring-yellow-400/50'
                    : 'from-yellow-800/30 to-yellow-900/30 border-yellow-400/20'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <CalendarClock className="w-5 h-5 text-yellow-400" />
                  <div className="text-2xl font-bold text-yellow-400">{stats.expiring30}</div>
                </div>
                <div className="text-sm text-gray-400">Expiring in 30 Days</div>
              </button>
              <button
                onClick={() => setExpiryFilter(expiryFilter === 'expired' ? 'all' : 'expired')}
                className={`bg-gradient-to-br backdrop-blur-sm rounded-xl p-4 border text-center transition-all hover:scale-[1.02] cursor-pointer ${
                  expiryFilter === 'expired'
                    ? 'from-red-600/40 to-red-700/40 border-red-400/50 ring-2 ring-red-400/50'
                    : 'from-red-800/30 to-red-900/30 border-red-400/20'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  <div className="text-2xl font-bold text-red-400">{stats.expired}</div>
                </div>
                <div className="text-sm text-gray-400">Expired</div>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="container mx-auto px-4 pb-8">
          <div className="max-w-6xl mx-auto">
            {/* Message Banner */}
            {message && (
              <div className={`mb-4 p-4 rounded-lg flex items-center ${
                message.type === 'success'
                  ? 'bg-green-500/20 border border-green-400/30 text-green-300'
                  : 'bg-red-500/20 border border-red-400/30 text-red-300'
              }`}>
                {message.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 mr-2" />
                ) : (
                  <AlertCircle className="w-5 h-5 mr-2" />
                )}
                {message.text}
                <button
                  onClick={() => setMessage(null)}
                  className="ml-auto text-gray-400 hover:text-white"
                >
                  ×
                </button>
              </div>
            )}

            {/* Controls */}
            <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-sm rounded-xl p-4 border border-primary-400/20 mb-6">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                {/* Search */}
                <div className="relative flex-1 w-full md:max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by email, name, or member ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-400/50"
                  />
                </div>

                {/* Filter */}
                <div className="flex gap-2 items-center">
                  <span className="text-gray-400 text-sm">Filter:</span>
                  <select
                    value={filterLevel}
                    onChange={(e) => setFilterLevel(e.target.value)}
                    className="bg-gray-800/50 border border-gray-600/50 rounded-lg text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400/50"
                  >
                    <option value="all">All Levels</option>
                    {ACCESS_LEVELS.map(level => (
                      <option key={level.value} value={level.value}>{level.label}</option>
                    ))}
                  </select>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={fetchUsers}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-700/50 hover:bg-gray-600/50 border border-gray-500/30 rounded-lg text-white transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                  <button
                    onClick={() => setShowNewAdmin(!showNewAdmin)}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600/30 hover:bg-purple-500/40 border border-purple-400/30 rounded-lg text-purple-300 transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    Add Admin
                  </button>
                </div>
              </div>

              {/* New Admin Form */}
              {showNewAdmin && (
                <form onSubmit={createAdmin} className="mt-4 pt-4 border-t border-gray-600/30">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                      <label className="block text-sm text-gray-400 mb-1">Email *</label>
                      <input
                        type="email"
                        required
                        value={newAdminEmail}
                        onChange={(e) => setNewAdminEmail(e.target.value)}
                        placeholder="admin@example.com"
                        className="w-full px-4 py-2 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-400/50"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm text-gray-400 mb-1">Name (optional)</label>
                      <input
                        type="text"
                        value={newAdminName}
                        onChange={(e) => setNewAdminName(e.target.value)}
                        placeholder="Admin Name"
                        className="w-full px-4 py-2 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-400/50"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="submit"
                        disabled={creating}
                        className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {creating ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Crown className="w-4 h-4" />
                        )}
                        Create Admin
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-gray-500">
                    If the email already exists, the user will be promoted to admin.
                  </p>
                </form>
              )}
            </div>

            {/* Error State */}
            {error && (
              <div className="bg-red-500/20 border border-red-400/30 rounded-xl p-6 text-center">
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                <p className="text-red-300">{error}</p>
                <button
                  onClick={fetchUsers}
                  className="mt-4 px-4 py-2 bg-red-600/30 hover:bg-red-500/40 rounded-lg text-red-300 transition-colors"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Loading State */}
            {loading && !error && (
              <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-sm rounded-xl p-12 border border-primary-400/20 text-center">
                <RefreshCw className="w-12 h-12 text-primary-400 mx-auto mb-3 animate-spin" />
                <p className="text-gray-300">Loading users...</p>
              </div>
            )}

            {/* Users Table */}
            {!loading && !error && (
              <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-sm rounded-xl border border-primary-400/20 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-800/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">User</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Member ID</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Access Level</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Status</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Joined</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-300">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700/50">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                            No users found matching your criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map(user => (
                          <tr key={user.id} className="hover:bg-gray-800/30 transition-colors">
                            <td className="px-4 py-3">
                              <div>
                                <div className="font-medium text-white">{user.name || 'Unnamed'}</div>
                                <div className="text-sm text-gray-400">{user.email}</div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-primary-300 font-mono text-sm">
                                {user.memberID || '-'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getAccessLevelColor(user.accessLevel)}`}>
                                {user.accessLevel === 'admin' && <Crown className="w-3 h-3 mr-1" />}
                                {user.accessLevel === 'subscriber' && <Shield className="w-3 h-3 mr-1" />}
                                {user.accessLevel === 'introduction' && <Clock className="w-3 h-3 mr-1" />}
                                {user.accessLevel}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {(() => {
                                const expiry = user.subscriptionExpiry || user.introductionExpiresAt
                                if (!expiry) {
                                  return user.subscriptionStatus === 'active'
                                    ? <span className="text-green-400">Active</span>
                                    : <span className="text-gray-500">-</span>
                                }
                                const daysLeft = getDaysRemaining(expiry) || '-'
                                const isExpired = daysLeft === 'Expired'
                                const isUrgent = !isExpired && daysLeft !== '-' && parseInt(daysLeft) <= 7
                                return (
                                  <div>
                                    <span className={`${
                                      isExpired ? 'text-red-400' : isUrgent ? 'text-orange-400' : 'text-green-400'
                                    }`}>
                                      {daysLeft}
                                    </span>
                                    <div className="text-xs text-gray-500">{formatDate(expiry)}</div>
                                  </div>
                                )
                              })()}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-400">
                              {formatDate(user.createdAt)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-center gap-2">
                                <select
                                  value={user.accessLevel}
                                  onChange={(e) => updateUserAccess(user.id, e.target.value)}
                                  disabled={updating === user.id}
                                  className={`text-sm px-3 py-1.5 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-400/50 disabled:opacity-50 ${
                                    updating === user.id ? 'animate-pulse' : ''
                                  }`}
                                >
                                  {ACCESS_LEVELS.map(level => (
                                    <option key={level.value} value={level.value}>
                                      {level.label}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => {
                                    setGrantTimeUser(user)
                                    setGrantDays(30)
                                    setCustomDate('')
                                    setGrantMode('days')
                                  }}
                                  className="p-1.5 bg-primary-600/30 hover:bg-primary-500/40 border border-primary-400/30 rounded-lg text-primary-300 transition-colors"
                                  title="Grant free time"
                                >
                                  <Gift className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer */}
                <div className="px-4 py-3 bg-gray-800/30 border-t border-gray-700/50 text-sm text-gray-400">
                  Showing {filteredUsers.length} of {users.length} users
                </div>
              </div>
            )}

            {/* Access Level Legend */}
            <div className="mt-6 bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-sm rounded-xl p-4 border border-gray-400/20">
              <h3 className="font-semibold text-white mb-3">Access Level Guide</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {ACCESS_LEVELS.map(level => (
                  <div key={level.value} className="flex items-start gap-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getAccessLevelColor(level.value)}`}>
                      {level.label}
                    </span>
                    <span className="text-sm text-gray-400">{level.description}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Grant Time Modal */}
        {grantTimeUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border border-primary-400/30 shadow-2xl w-full max-w-md">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-700/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-600/20 rounded-lg">
                    <Gift className="w-5 h-5 text-primary-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Grant Free Time</h3>
                    <p className="text-sm text-gray-400">{grantTimeUser.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => setGrantTimeUser(null)}
                  className="p-2 hover:bg-gray-700/50 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 space-y-4">
                {/* Current Status */}
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <div className="text-sm text-gray-400 mb-1">Current Status</div>
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getAccessLevelColor(grantTimeUser.accessLevel)}`}>
                      {grantTimeUser.accessLevel}
                    </span>
                    {(grantTimeUser.subscriptionExpiry || grantTimeUser.introductionExpiresAt) && (
                      <span className="text-sm text-gray-300">
                        Expires: {formatDate(grantTimeUser.subscriptionExpiry || grantTimeUser.introductionExpiresAt)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Mode Toggle */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setGrantMode('days')}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                      grantMode === 'days'
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
                    }`}
                  >
                    Add Days
                  </button>
                  <button
                    onClick={() => setGrantMode('date')}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                      grantMode === 'date'
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
                    }`}
                  >
                    Set Date
                  </button>
                </div>

                {/* Days Input */}
                {grantMode === 'days' && (
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Days to Add</label>
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {GRANT_DAYS_OPTIONS.map(days => (
                        <button
                          key={days}
                          onClick={() => setGrantDays(days)}
                          className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                            grantDays === days
                              ? 'bg-primary-600 text-white'
                              : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
                          }`}
                        >
                          {days}
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      min="1"
                      value={grantDays}
                      onChange={(e) => setGrantDays(parseInt(e.target.value) || 1)}
                      className="w-full px-4 py-2 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-400/50"
                      placeholder="Custom days"
                    />
                  </div>
                )}

                {/* Date Input */}
                {grantMode === 'date' && (
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Set Expiry Date</label>
                    <input
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-2 bg-gray-800/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-400/50"
                    />
                  </div>
                )}

                {/* Preview */}
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <div className="text-sm text-gray-400 mb-1">New Expiry</div>
                  <div className="text-lg font-medium text-primary-400">
                    {grantMode === 'days' ? (
                      (() => {
                        const base = grantTimeUser.subscriptionExpiry
                          ? new Date(grantTimeUser.subscriptionExpiry) > new Date()
                            ? new Date(grantTimeUser.subscriptionExpiry)
                            : new Date()
                          : new Date()
                        const newDate = new Date(base)
                        newDate.setDate(newDate.getDate() + grantDays)
                        return formatDate(newDate.toISOString())
                      })()
                    ) : customDate ? (
                      formatDate(customDate)
                    ) : (
                      'Select a date'
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex gap-3 p-4 border-t border-gray-700/50">
                <button
                  onClick={() => setGrantTimeUser(null)}
                  className="flex-1 py-2 px-4 bg-gray-700/50 hover:bg-gray-600/50 rounded-lg text-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={grantFreeTime}
                  disabled={granting || (grantMode === 'date' && !customDate)}
                  className="flex-1 py-2 px-4 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {granting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Granting...
                    </>
                  ) : (
                    <>
                      <Gift className="w-4 h-4" />
                      Grant Time
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
