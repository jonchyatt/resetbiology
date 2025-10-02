"use client"

import { useState } from "react"
import { TrendingUp, DollarSign, Users, CheckCircle, Clock } from "lucide-react"

interface AffiliateSignupProps {
  onSignupComplete?: (affiliateCode: string) => void
}

export function AffiliateSignup({ onSignupComplete }: AffiliateSignupProps) {
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    experience: '',
    audience: '',
    motivation: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  const experienceOptions = [
    { value: 'beginner', label: 'New to affiliate marketing', commission: '30%' },
    { value: 'intermediate', label: 'Some affiliate experience', commission: '32%' },
    { value: 'advanced', label: 'Experienced affiliate marketer', commission: '35%' }
  ]

  const audienceOptions = [
    { value: 'social', label: 'Social Media Following', desc: 'Instagram, TikTok, YouTube' },
    { value: 'email', label: 'Email List', desc: 'Newsletter, blog subscribers' },
    { value: 'network', label: 'Personal Network', desc: 'Friends, family, colleagues' },
    { value: 'content', label: 'Content Creation', desc: 'Blog, podcast, video content' },
    { value: 'other', label: 'Other', desc: 'Different approach' }
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!agreedToTerms) return

    setIsSubmitting(true)

    try {
      // Generate affiliate code
      const affiliateCode = `RB${formData.name.substring(0, 3).toUpperCase()}${Date.now().toString().slice(-6)}`
      
      // Mock API call
      console.log('Creating affiliate account:', {
        ...formData,
        affiliateCode,
        commissionRate: formData.experience === 'advanced' ? 0.35 : formData.experience === 'intermediate' ? 0.32 : 0.30
      })

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 2000))

      onSignupComplete?.(affiliateCode)
      
      alert(`🎉 Welcome to Reset Biology Affiliates! Your code: ${affiliateCode}. Start sharing and earning 30%+ commissions!`)

    } catch (error) {
      console.error('Affiliate signup error:', error)
      alert('Signup failed. Please try again or contact support.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header Psychology */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center mb-4">
          <img src="/logo.png" alt="Reset Biology" className="h-12 w-auto mr-4" />
          <h1 className="text-3xl font-bold text-gray-900">
            Affiliate Program
          </h1>
        </div>
        <p className="text-lg text-gray-600 max-w-3xl mx-auto">
          Help people access <strong className="text-primary-600">real medical-grade solutions</strong> 
          while earning substantial commissions. You're not just making money—you're changing lives.
        </p>
      </div>

      {/* Value Proposition */}
      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <DollarSign className="w-8 h-8 text-green-600 mx-auto mb-3" />
          <h3 className="font-bold text-green-800 mb-2">30-35% Commission</h3>
          <p className="text-sm text-green-700">
            Earn $75-350 per referral on partner investments. Higher rates for experienced affiliates.
          </p>
        </div>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <Users className="w-8 h-8 text-blue-600 mx-auto mb-3" />
          <h3 className="font-bold text-blue-800 mb-2">High Conversion</h3>
          <p className="text-sm text-blue-700">
            8.7% average conversion rate. People are desperate for real solutions to weight struggles.
          </p>
        </div>
        
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 text-center">
          <TrendingUp className="w-8 h-8 text-purple-600 mx-auto mb-3" />
          <h3 className="font-bold text-purple-800 mb-2">Recurring Value</h3>
          <p className="text-sm text-purple-700">
            Successful clients often upgrade tiers and refer others. Build residual income.
          </p>
        </div>
      </div>

      {/* Signup Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg p-6 shadow-lg">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Start Earning Today</h2>
        
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              placeholder="Your full name"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email Address *</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              placeholder="your@email.com"
            />
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">Experience Level *</label>
          <div className="grid gap-3 md:grid-cols-3">
            {experienceOptions.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, experience: option.value }))}
                className={`p-4 rounded-lg border text-left transition-all ${
                  formData.experience === option.value
                    ? 'border-primary-400 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-semibold text-gray-900">{option.label}</div>
                <div className="text-sm text-primary-600 font-semibold">{option.commission} Commission</div>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">Your Audience *</label>
          <div className="grid gap-2">
            {audienceOptions.map(option => (
              <label key={option.value} className="flex items-center p-3 rounded-lg border hover:bg-gray-50">
                <input
                  type="radio"
                  name="audience"
                  value={option.value}
                  checked={formData.audience === option.value}
                  onChange={(e) => setFormData(prev => ({ ...prev, audience: e.target.value }))}
                  className="mr-3"
                  required
                />
                <div>
                  <div className="font-semibold text-gray-900">{option.label}</div>
                  <div className="text-sm text-gray-600">{option.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Why are you interested in promoting Reset Biology? *
          </label>
          <textarea
            required
            value={formData.motivation}
            onChange={(e) => setFormData(prev => ({ ...prev, motivation: e.target.value }))}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
            rows={4}
            placeholder="Share your motivation for helping others with their health journey..."
          />
        </div>

        {/* Terms Agreement */}
        <div className="mt-6 mb-6">
          <label className="flex items-start">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-1 mr-3"
            />
            <span className="text-sm text-gray-700">
              I agree to promote Reset Biology ethically and accurately. I understand commissions are paid monthly 
              and become confirmed when referred users complete their program requirements. I agree to the{' '}
              <a href="/affiliate-terms" className="text-primary-600 hover:underline">Affiliate Terms</a> and{' '}
              <a href="/privacy" className="text-primary-600 hover:underline">Privacy Policy</a>.
            </span>
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!agreedToTerms || isSubmitting || !formData.name || !formData.email || !formData.experience || !formData.audience || !formData.motivation}
          className={`w-full py-4 px-6 rounded-lg font-bold text-lg transition-all ${
            agreedToTerms && !isSubmitting && formData.name && formData.email && formData.experience && formData.audience && formData.motivation
              ? 'bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isSubmitting ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
              Creating Your Affiliate Account...
            </div>
          ) : (
            <>Start Earning Commissions Today 🚀</>
          )}
        </button>
      </form>

      {/* Success Psychology */}
      <div className="mt-8 bg-gradient-to-r from-green-400 to-blue-400 text-white rounded-lg p-6 text-center">
        <h3 className="text-xl font-bold mb-2">💡 Why Reset Biology Affiliates Succeed</h3>
        <div className="grid gap-4 md:grid-cols-2 text-left">
          <div className="flex items-start">
            <CheckCircle className="w-5 h-5 text-green-200 mr-3 mt-1 flex-shrink-0" />
            <div>
              <h4 className="font-semibold">Real Medical Solution</h4>
              <p className="text-sm text-green-100">Retatrutide is clinically proven, unlike dangerous alternatives</p>
            </div>
          </div>
          <div className="flex items-start">
            <Clock className="w-5 h-5 text-blue-200 mr-3 mt-1 flex-shrink-0" />
            <div>
              <h4 className="font-semibold">Perfect Market Timing</h4>
              <p className="text-sm text-blue-100">GLP-1 market exploding, but most products are harmful</p>
            </div>
          </div>
          <div className="flex items-start">
            <DollarSign className="w-5 h-5 text-yellow-200 mr-3 mt-1 flex-shrink-0" />
            <div>
              <h4 className="font-semibold">High-Value Product</h4>
              <p className="text-sm text-yellow-100">$250-1000 deposits mean substantial commissions per conversion</p>
            </div>
          </div>
          <div className="flex items-start">
            <Users className="w-5 h-5 text-purple-200 mr-3 mt-1 flex-shrink-0" />
            <div>
              <h4 className="font-semibold">Proven Psychology</h4>
              <p className="text-sm text-purple-100">Refundable investment model creates high completion rates</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}