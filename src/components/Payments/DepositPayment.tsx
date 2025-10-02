"use client"

import { useState } from "react"
import { CreditCard, Shield, TrendingUp, Award, DollarSign } from "lucide-react"

interface DepositPaymentProps {
  onPaymentSuccess?: (depositId: string) => void
}

export function DepositPayment({ onPaymentSuccess }: DepositPaymentProps) {
  const [selectedAmount, setSelectedAmount] = useState(500)
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'bank'>('card')
  const [isProcessing, setIsProcessing] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  const depositOptions = [
    {
      amount: 250,
      tier: 'Starter',
      multiplier: 1.0,
      description: 'Basic program access',
      modules: 3,
      support: 'Email support',
      color: 'gray'
    },
    {
      amount: 500,
      tier: 'Partner',
      multiplier: 1.1,
      description: 'Complete program + 10% bonus',
      modules: 7,
      support: 'Priority support + group calls',
      color: 'primary',
      popular: true
    },
    {
      amount: 1000,
      tier: 'Elite',
      multiplier: 1.25,
      description: 'Everything + 25% bonus + 1:1 coaching',
      modules: 10,
      support: 'Personal coaching + direct access',
      color: 'purple'
    }
  ]

  const selectedOption = depositOptions.find(opt => opt.amount === selectedAmount)!

  const handlePayment = async () => {
    setIsProcessing(true)
    
    try {
      // TODO: Integrate with Stripe
      const paymentData = {
        amount: selectedAmount,
        tier: selectedOption.tier,
        userId: 'demo-user', // TODO: Get from auth
        paymentMethod,
        timestamp: new Date().toISOString()
      }

      // Mock Stripe integration
      console.log('Processing payment:', paymentData)
      
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      // Create deposit record
      const response = await fetch('/api/deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: selectedAmount,
          tier: selectedOption.tier,
          multiplier: selectedOption.multiplier,
          userId: 'demo-user'
        })
      })

      if (response.ok) {
        const result = await response.json()
        onPaymentSuccess?.(result.depositId)
        
        // Success psychology
        alert(`🎉 Your $${selectedAmount} Partner Stake is Active! Welcome to ${selectedOption.tier} tier. Start earning immediately!`)
      }
      
    } catch (error) {
      console.error('Payment error:', error)
      alert('Payment failed. Please try again or contact support.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header Psychology */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          🎯 Activate Your Partner Success Stake
        </h1>
        <p className="text-lg text-gray-600 max-w-3xl mx-auto">
          This isn't a fee—it's a <strong className="text-primary-600">refundable investment</strong> in your success. 
          Complete your program and <strong>earn it back plus bonus</strong> for your achievement.
        </p>
      </div>

      {/* Psychology Benefits */}
      <div className="bg-gradient-to-r from-blue-50 to-primary-50 p-6 rounded-lg mb-8 border border-primary-200">
        <h2 className="text-xl font-bold text-gray-900 mb-4">🧠 Why Partner Stakes Work</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex items-start">
            <TrendingUp className="w-5 h-5 text-primary-600 mr-3 mt-1 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-gray-900">2.5x Higher Success Rate</h3>
              <p className="text-sm text-gray-600">People work harder to avoid losing something they have vs. earning something new</p>
            </div>
          </div>
          <div className="flex items-start">
            <Award className="w-5 h-5 text-secondary-600 mr-3 mt-1 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-gray-900">Escalating Rewards</h3>
              <p className="text-sm text-gray-600">Higher tiers earn bonus payouts - you can make money by succeeding</p>
            </div>
          </div>
          <div className="flex items-start">
            <Shield className="w-5 h-5 text-green-600 mr-3 mt-1 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-gray-900">100% Refundable</h3>
              <p className="text-sm text-gray-600">Complete your program and get every dollar back (plus bonus)</p>
            </div>
          </div>
          <div className="flex items-start">
            <DollarSign className="w-5 h-5 text-purple-600 mr-3 mt-1 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-gray-900">Partner Ownership</h3>
              <p className="text-sm text-gray-600">You're not paying us - you're investing in your own success</p>
            </div>
          </div>
        </div>
      </div>

      {/* Deposit Options */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        {depositOptions.map(option => (
          <div 
            key={option.amount}
            className={`relative p-6 rounded-lg border-2 cursor-pointer transition-all ${
              selectedAmount === option.amount 
                ? 'border-primary-400 bg-primary-50 scale-105' 
                : 'border-gray-200 hover:border-gray-300'
            } ${option.popular ? 'ring-2 ring-primary-400 ring-opacity-50' : ''}`}
            onClick={() => setSelectedAmount(option.amount)}
          >
            {option.popular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-primary-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                  MOST POPULAR
                </span>
              </div>
            )}
            
            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-900 mb-2">{option.tier} Partner</h3>
              <div className="text-3xl font-bold text-primary-600 mb-1">${option.amount}</div>
              <div className="text-sm text-gray-600 mb-4">
                Potential return: <span className="font-semibold text-green-600">
                  ${Math.round(option.amount * option.multiplier)}
                </span>
              </div>
              
              <div className="text-left space-y-2 text-sm">
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-primary-400 rounded-full mr-2"></span>
                  {option.modules} Audio modules included
                </div>
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-secondary-400 rounded-full mr-2"></span>
                  {option.support}
                </div>
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                  {option.multiplier > 1 ? `${Math.round((option.multiplier - 1) * 100)}% bonus payout` : 'Base payout'}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Payment Method */}
      <div className="bg-white rounded-lg p-6 shadow-md mb-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">💳 Payment Method</h3>
        
        <div className="grid gap-3 md:grid-cols-2 mb-6">
          <button
            onClick={() => setPaymentMethod('card')}
            className={`p-4 rounded-lg border text-left transition-all ${
              paymentMethod === 'card' 
                ? 'border-primary-400 bg-primary-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center">
              <CreditCard className="w-5 h-5 text-primary-600 mr-3" />
              <div>
                <h4 className="font-semibold text-gray-900">Credit/Debit Card</h4>
                <p className="text-sm text-gray-600">Instant activation • Secure processing</p>
              </div>
            </div>
          </button>
          
          <button
            onClick={() => setPaymentMethod('bank')}
            className={`p-4 rounded-lg border text-left transition-all ${
              paymentMethod === 'bank' 
                ? 'border-primary-400 bg-primary-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center">
              <Shield className="w-5 h-5 text-green-600 mr-3" />
              <div>
                <h4 className="font-semibold text-gray-900">Bank Transfer (ACH)</h4>
                <p className="text-sm text-gray-600">Lower fees • 1-2 day activation</p>
              </div>
            </div>
          </button>
        </div>

        {/* Terms Agreement */}
        <div className="mb-6">
          <label className="flex items-start">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-1 mr-3"
            />
            <span className="text-sm text-gray-700">
              I understand this is a <strong>refundable partner investment</strong> that I earn back by completing 
              my program requirements. I agree to the{' '}
              <a href="/terms" className="text-primary-600 hover:underline">Partner Success Terms</a> and{' '}
              <a href="/privacy" className="text-primary-600 hover:underline">Privacy Policy</a>.
            </span>
          </label>
        </div>

        {/* Payment Button */}
        <button
          onClick={handlePayment}
          disabled={!agreedToTerms || isProcessing}
          className={`w-full py-4 px-6 rounded-lg font-bold text-lg transition-all ${
            agreedToTerms && !isProcessing
              ? 'bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-600 hover:to-secondary-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isProcessing ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
              Processing Your Partner Investment...
            </div>
          ) : (
            <>Activate ${selectedAmount} Partner Stake → Start Earning</>
          )}
        </button>

        <p className="text-xs text-gray-500 text-center mt-3">
          Secure 256-bit encryption • Processed by Stripe • No hidden fees
        </p>
      </div>

      {/* Success Guarantee */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
        <h3 className="text-lg font-bold text-green-800 mb-2">🛡️ 100% Success Guarantee</h3>
        <p className="text-green-700 text-sm">
          Complete your program requirements within 90 days and earn back your full stake plus bonus. 
          If you're not completely satisfied with the program quality, we'll refund your investment—no questions asked.
        </p>
      </div>
    </div>
  )
}