"use client"

import Link from "next/link"
import { Database, Dumbbell, Apple, Syringe, Settings, Package, ShoppingCart, ClipboardList, Wind, Mic, Eye, Zap, Target, Brain, BookOpen, Layout, Users } from "lucide-react"

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative"
         style={{
           backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
           backgroundSize: 'cover',
           backgroundPosition: 'center',
           backgroundAttachment: 'fixed'
         }}>
      <div className="relative z-10">
        {/* Title */}
        <div className="text-center py-8">
          <div className="mb-4">
            <Link href="/portal" className="inline-flex items-center text-primary-300 hover:text-primary-200 font-medium text-sm transition-colors drop-shadow-sm">
              ← Back to Portal
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-primary-300 mb-2">Admin Portal • System Management</h1>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 text-shadow-lg animate-fade-in">
            <span className="text-secondary-400">Admin</span> Dashboard
          </h2>
          <p className="text-xl md:text-2xl text-gray-200 max-w-3xl mx-auto font-medium leading-relaxed drop-shadow-sm">
            Manage peptides, workouts, food database, and system settings
          </p>
        </div>

        {/* Admin Cards */}
        <div className="container mx-auto px-4 pb-8">
          <div className="max-w-6xl mx-auto grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            
            {/* Peptides Management */}
            <Link href="/admin/peptides" className="group">
              <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 shadow-2xl hover:shadow-primary-400/20 group-hover:scale-105 transition-all duration-300">
                <div className="flex items-center mb-4">
                  <Syringe className="w-8 h-8 text-primary-400 mr-3" />
                  <h3 className="text-xl font-bold text-white">Peptides</h3>
                </div>
                <p className="text-gray-300 mb-4">
                  Add, edit, and manage peptides in the library. Set dosages, timing, and protocols.
                </p>
                <div className="text-primary-300 font-medium group-hover:text-primary-200 transition-colors">
                  Manage Peptides →
                </div>
              </div>
            </Link>

            {/* Workout Management */}
            <Link href="/admin/workouts" className="group">
              <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-secondary-400/30 shadow-2xl hover:shadow-secondary-400/20 group-hover:scale-105 transition-all duration-300">
                <div className="flex items-center mb-4">
                  <Dumbbell className="w-8 h-8 text-secondary-400 mr-3" />
                  <h3 className="text-xl font-bold text-white">Workouts</h3>
                </div>
                <p className="text-gray-300 mb-4">
                  Build exercise library and create workout programs for different fitness goals.
                </p>
                <div className="text-secondary-300 font-medium group-hover:text-secondary-200 transition-colors">
                  Manage Workouts →
                </div>
              </div>
            </Link>

            {/* Food Database Management */}
            <Link href="/admin/food" className="group">
              <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-green-400/30 shadow-2xl hover:shadow-green-400/20 group-hover:scale-105 transition-all duration-300">
                <div className="flex items-center mb-4">
                  <Apple className="w-8 h-8 text-green-400 mr-3" />
                  <h3 className="text-xl font-bold text-white">Food Database</h3>
                </div>
                <p className="text-gray-300 mb-4">
                  Expand the food database with custom foods, brands, and nutritional information.
                </p>
                <div className="text-green-300 font-medium group-hover:text-green-200 transition-colors">
                  Manage Foods →
                </div>
              </div>
            </Link>

            {/* Breath Exercises */}
            <Link href="/admin/breath" className="group">
              <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-teal-400/30 shadow-2xl hover:shadow-teal-400/20 group-hover:scale-105 transition-all duration-300">
                <div className="flex items-center mb-4">
                  <Wind className="w-8 h-8 text-teal-400 mr-3" />
                  <h3 className="text-xl font-bold text-white">Breath Exercises</h3>
                </div>
                <p className="text-gray-300 mb-4">
                  Create and manage breathing exercises like Vagal Reset, Relaxation, and sample exercises.
                </p>
                <div className="text-teal-300 font-medium group-hover:text-teal-200 transition-colors">
                  Manage Exercises →
                </div>
              </div>
            </Link>

            {/* User Management */}
            <Link href="/admin/users" className="group">
              <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-indigo-400/30 shadow-2xl hover:shadow-indigo-400/20 group-hover:scale-105 transition-all duration-300">
                <div className="flex items-center mb-4">
                  <Users className="w-8 h-8 text-indigo-400 mr-3" />
                  <h3 className="text-xl font-bold text-white">User Management</h3>
                </div>
                <p className="text-gray-300 mb-4">
                  View all users, adjust access levels (guest, introduction, subscriber, admin), and create admins.
                </p>
                <div className="text-indigo-300 font-medium group-hover:text-indigo-200 transition-colors">
                  Manage Users →
                </div>
              </div>
            </Link>

            {/* Agent Training Center */}
            <Link href="/admin/agents" className="group">
              <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-pink-400/30 shadow-2xl hover:shadow-pink-400/20 group-hover:scale-105 transition-all duration-300">
                <div className="flex items-center mb-4">
                  <Mic className="w-8 h-8 text-pink-400 mr-3" />
                  <h3 className="text-xl font-bold text-white">Agent Training</h3>
                </div>
                <p className="text-gray-300 mb-4">
                  Train AI voice agents with custom instructions, speech patterns, and domain knowledge.
                </p>
                <div className="text-pink-300 font-medium group-hover:text-pink-200 transition-colors">
                  Train Agents →
                </div>
              </div>
            </Link>

            {/* Assessment Funnel */}
            <Link href="/admin/assessments" className="group">
              <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-cyan-400/30 shadow-2xl hover:shadow-cyan-400/20 group-hover:scale-105 transition-all duration-300">
                <div className="flex items-center mb-4">
                  <ClipboardList className="w-8 h-8 text-cyan-400 mr-3" />
                  <h3 className="text-xl font-bold text-white">Assessment Funnel</h3>
                </div>
                <p className="text-gray-300 mb-4">
                  View submissions, edit questions, and manage the cellular weight loss assessment quiz.
                </p>
                <div className="text-cyan-300 font-medium group-hover:text-cyan-200 transition-colors">
                  Manage Assessments →
                </div>
              </div>
            </Link>

            {/* Database Overview */}
            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-gray-400/30 shadow-2xl hover:shadow-gray-400/20 transition-all duration-300">
              <div className="flex items-center mb-4">
                <Database className="w-8 h-8 text-gray-400 mr-3" />
                <h3 className="text-xl font-bold text-white">Database Stats</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-300">Peptides:</span>
                  <span className="text-primary-300 font-medium">12</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Exercises:</span>
                  <span className="text-secondary-300 font-medium">21</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Foods:</span>
                  <span className="text-green-300 font-medium">21</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Programs:</span>
                  <span className="text-blue-300 font-medium">3</span>
                </div>
              </div>
            </div>

            {/* System Settings */}
            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-yellow-400/30 shadow-2xl hover:shadow-yellow-400/20 transition-all duration-300">
              <div className="flex items-center mb-4">
                <Settings className="w-8 h-8 text-yellow-400 mr-3" />
                <h3 className="text-xl font-bold text-white">System Settings</h3>
              </div>
              <div className="space-y-2 text-sm text-gray-300">
                <div className="flex justify-between">
                  <span>App Version:</span>
                  <span className="text-yellow-300">v2.1.0</span>
                </div>
                <div className="flex justify-between">
                  <span>Database:</span>
                  <span className="text-green-300">●&#160;Connected</span>
                </div>
                <div className="flex justify-between">
                  <span>Auth:</span>
                  <span className="text-green-300">●&#160;Active</span>
                </div>
                <div className="flex justify-between">
                  <span>Last Backup:</span>
                  <span className="text-gray-400">2h ago</span>
                </div>
              </div>
            </div>

            {/* Package Builder */}
            <Link href="/admin/packages" className="group">
              <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-orange-400/30 shadow-2xl hover:shadow-orange-400/20 group-hover:scale-105 transition-all duration-300">
                <div className="flex items-center mb-4">
                  <Package className="w-8 h-8 text-orange-400 mr-3" />
                  <h3 className="text-xl font-bold text-white">Package Builder</h3>
                </div>
                <p className="text-gray-300 mb-4">
                  Create peptide bundles by combining multiple products with custom pricing.
                </p>
                <div className="text-orange-300 font-medium group-hover:text-orange-200 transition-colors">
                  Build Packages →
                </div>
              </div>
            </Link>

            {/* Store Management */}
            <Link href="/admin/store" className="group">
              <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-purple-400/30 shadow-2xl hover:shadow-purple-400/20 group-hover:scale-105 transition-all duration-300">
                <div className="flex items-center mb-4">
                  <ShoppingCart className="w-8 h-8 text-purple-400 mr-3" />
                  <h3 className="text-xl font-bold text-white">Store Management</h3>
                </div>
                <p className="text-gray-300 mb-4">
                  Manage products, pricing, and Stripe integration for the e-commerce store.
                </p>
                <div className="text-purple-300 font-medium group-hover:text-purple-200 transition-colors">
                  Manage Store →
                </div>
              </div>
            </Link>

            {/* Order Management */}
            <Link href="/admin/orders" className="group">
              <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-amber-400/30 shadow-2xl hover:shadow-amber-400/20 group-hover:scale-105 transition-all duration-300">
                <div className="flex items-center mb-4">
                  <Package className="w-8 h-8 text-amber-400 mr-3" />
                  <h3 className="text-xl font-bold text-white">Orders</h3>
                </div>
                <p className="text-gray-300 mb-4">
                  View and fulfill customer orders. Update shipping status and add tracking numbers.
                </p>
                <div className="text-amber-300 font-medium group-hover:text-amber-200 transition-colors">
                  Manage Orders →
                </div>
              </div>
            </Link>

            {/* Quick Actions */}
            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-blue-400/30 shadow-2xl hover:shadow-blue-400/20 transition-all duration-300">
              <div className="flex items-center mb-4">
                <h3 className="text-xl font-bold text-white">Quick Actions</h3>
              </div>
              <div className="space-y-3">
                <button className="w-full bg-gradient-to-br from-primary-500/20 to-primary-600/30 hover:from-primary-400/30 hover:to-primary-500/40 text-white py-2 px-4 rounded-lg text-sm transition-all backdrop-blur-sm border border-primary-400/30 shadow-xl hover:shadow-primary-400/20">
                  Export All Data
                </button>
                <button className="w-full bg-gradient-to-br from-green-500/20 to-green-600/30 hover:from-green-400/30 hover:to-green-500/40 text-white py-2 px-4 rounded-lg text-sm transition-all backdrop-blur-sm border border-green-400/30 shadow-xl hover:shadow-green-400/20">
                  Backup Database
                </button>
                <button className="w-full bg-gradient-to-br from-yellow-500/20 to-yellow-600/30 hover:from-yellow-400/30 hover:to-yellow-500/40 text-white py-2 px-4 rounded-lg text-sm transition-all backdrop-blur-sm border border-yellow-400/30 shadow-xl hover:shadow-yellow-400/20">
                  System Health Check
                </button>
              </div>
            </div>

          </div>

          {/* Portal Module Manager Link */}
          <div className="max-w-6xl mx-auto mt-12">
            <Link href="/admin/portal" className="group block">
              <div className="bg-gradient-to-br from-indigo-600/20 to-indigo-700/20 backdrop-blur-sm rounded-xl p-6 border border-indigo-400/30 shadow-2xl hover:shadow-indigo-400/20 group-hover:scale-[1.01] transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Layout className="w-8 h-8 text-indigo-400 mr-3" />
                    <div>
                      <h2 className="text-2xl font-bold text-white">Portal Module Manager</h2>
                      <p className="text-gray-400 text-sm mt-1">Toggle modules on/off in the client portal</p>
                    </div>
                  </div>
                  <div className="text-indigo-300 font-medium group-hover:text-indigo-200 transition-colors">
                    Manage Modules →
                  </div>
                </div>
              </div>
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}