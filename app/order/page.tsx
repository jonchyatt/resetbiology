"use client"

import { useState } from "react"
import { ShoppingCart, Check, Star, Clock, Shield, CreditCard, Truck, RefreshCw, AlertCircle } from "lucide-react"

interface PeptidePackage {
  id: string
  name: string
  description: string
  peptides: string[]
  duration: string
  price: number
  originalPrice?: number
  popular?: boolean
  features: string[]
  results: string[]
  subscriptionDiscount?: number
}

const peptidePackages: PeptidePackage[] = [
  {
    id: "starter",
    name: "Foundation Protocol",
    description: "Perfect for beginners ready to optimize their metabolism",
    peptides: ["Ipamorelin 5mg", "CJC-1295 (no DAC) 2mg"],
    duration: "30 days",
    price: 297,
    originalPrice: 350,
    features: [
      "Comprehensive dosing guide",
      "Injection supplies included",
      "24/7 medical support",
      "Progress tracking app access"
    ],
    results: [
      "Improved sleep quality",
      "Enhanced fat burning",
      "Better recovery",
      "Increased energy"
    ],
    subscriptionDiscount: 15
  },
  {
    id: "advanced",
    name: "Complete Optimization",
    description: "Our most comprehensive protocol for serious transformation",
    peptides: ["Ipamorelin 10mg", "CJC-1295 (no DAC) 5mg", "BPC-157 5mg"],
    duration: "60 days",
    price: 597,
    originalPrice: 750,
    popular: true,
    features: [
      "Premium peptide blend",
      "Personalized dosing protocol",
      "Weekly check-ins with specialists",
      "Complete injection kit",
      "Success guarantee"
    ],
    results: [
      "Significant fat loss",
      "Muscle preservation",
      "Faster healing",
      "Optimal hormone balance",
      "Enhanced cognitive function"
    ],
    subscriptionDiscount: 20
  },
  {
    id: "elite",
    name: "Elite Performance",
    description: "Maximum results protocol with premium peptides",
    peptides: ["Ipamorelin 15mg", "CJC-1295 (no DAC) 8mg", "BPC-157 10mg", "TB-500 5mg"],
    duration: "90 days",
    price: 897,
    originalPrice: 1200,
    features: [
      "Highest quality peptides",
      "Custom protocol design",
      "Direct physician access",
      "Premium injection supplies",
      "VIP support priority",
      "Success deposit program"
    ],
    results: [
      "Dramatic body composition changes",
      "Peak physical performance",
      "Accelerated healing",
      "Optimized recovery",
      "Enhanced longevity markers"
    ],
    subscriptionDiscount: 25
  }
]

const individualPeptides = [
  {
    id: "bpc157",
    name: "BPC-157",
    amount: "10mg",
    price: 99.97,
    inStock: false,
    description: "Body Protection Compound - Promotes healing across various tissues, wound healing, and musculoskeletal recovery",
    benefits: ["Tissue repair", "Wound healing", "Anti-inflammatory", "Gut health"]
  },
  {
    id: "ipamorelin",
    name: "Ipamorelin",
    amount: "10mg",
    price: 79.97,
    inStock: true,
    description: "Growth hormone secretagogue - Stimulates natural GH release without affecting other hormones",
    benefits: ["Fat loss", "Muscle growth", "Better sleep", "Anti-aging"]
  },
  {
    id: "dsip",
    name: "DSIP",
    amount: "5mg",
    price: 55.97,
    inStock: true,
    description: "Delta Sleep-Inducing Peptide - Promotes deep restorative sleep and recovery",
    benefits: ["Deep sleep", "Recovery", "Stress reduction", "Circadian rhythm"]
  },
  {
    id: "amino1mq",
    name: "5-Amino-1MQ",
    amount: "10mg",
    price: 74.97,
    inStock: false,
    description: "NNMT inhibitor - Supports metabolic health and fat loss",
    benefits: ["Fat metabolism", "Energy boost", "Cellular health", "Weight management"]
  },
  {
    id: "epithalon",
    name: "Epithalon",
    amount: "20mg",
    price: 94.97,
    inStock: true,
    description: "Anti-aging tetrapeptide - Influences telomere length and activates telomerase",
    benefits: ["Anti-aging", "Telomere health", "Sleep quality", "Immune support"]
  },
  {
    id: "ghkcu",
    name: "GHK-Cu",
    amount: "50mg",
    price: 84.97,
    inStock: false,
    description: "Copper peptide complex - Promotes collagen synthesis and skin regeneration",
    benefits: ["Skin health", "Collagen production", "Anti-inflammatory", "Hair growth"]
  },
  {
    id: "motsc",
    name: "MOTS-c",
    amount: "10mg",
    price: 109.97,
    inStock: true,
    description: "Mitochondrial peptide - Enhances metabolic function and insulin sensitivity",
    benefits: ["Metabolic health", "Insulin sensitivity", "Energy production", "Exercise performance"]
  },
  {
    id: "tb500",
    name: "TB-500",
    amount: "10mg",
    price: 164.97,
    inStock: true,
    description: "Thymosin Beta-4 fragment - Accelerates healing and reduces inflammation",
    benefits: ["Rapid healing", "Flexibility", "Reduced inflammation", "Cardiovascular health"]
  }
]

export default function OrderPage() {
  const [selectedPackage, setSelectedPackage] = useState<string>("")
  const [isSubscription, setIsSubscription] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)

  const selectedPkg = peptidePackages.find(pkg => pkg.id === selectedPackage)
  
  const getPrice = (pkg: PeptidePackage) => {
    if (isSubscription && pkg.subscriptionDiscount) {
      return pkg.price * (1 - pkg.subscriptionDiscount / 100)
    }
    return pkg.price
  }

  const handleOrderClick = (packageId: string) => {
    setSelectedPackage(packageId)
    setShowCheckout(true)
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
        <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm shadow-2xl border-b border-primary-400/30">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <img src="/logo1.png" alt="Reset Biology" className="h-8 w-auto mr-3 rounded-lg drop-shadow-lg bg-white/10 backdrop-blur-sm p-1 border border-white/20" />
                <div>
                  <h1 className="text-xl font-bold text-white drop-shadow-lg">Order Peptides</h1>
                  <span className="text-lg text-gray-200 drop-shadow-sm">• Premium Protocols</span>
                </div>
              </div>
              <a href="/portal" className="text-primary-300 hover:text-primary-200 font-medium text-sm transition-colors drop-shadow-sm">
                ← Back to Portal
              </a>
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="text-center py-8">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 text-shadow-lg animate-fade-in">
            <span className="text-secondary-400">Premium</span> Peptide Protocols
          </h2>
          <p className="text-xl md:text-2xl text-gray-200 max-w-4xl mx-auto font-medium leading-relaxed drop-shadow-sm mb-6">
            Physician-supervised peptide therapy with comprehensive support and tracking
          </p>
          
          {/* Trust Indicators */}
          <div className="flex justify-center items-center gap-6 text-sm text-gray-300">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-400" />
              <span>FDA Regulated Facility</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-400" />
              <span>99.8% Purity Guaranteed</span>
            </div>
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-blue-400" />
              <span>Cold-Chain Shipping</span>
            </div>
          </div>
        </div>

        {/* Subscription Toggle */}
        <div className="container mx-auto px-4 mb-8">
          <div className="max-w-md mx-auto bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-4 border border-primary-400/30 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-white font-medium">Subscribe & Save</span>
              <button
                onClick={() => setIsSubscription(!isSubscription)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isSubscription ? 'bg-primary-500' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isSubscription ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            {isSubscription && (
              <p className="text-sm text-primary-300 mt-2">Save 15-25% with automatic monthly delivery</p>
            )}
          </div>
        </div>

        {/* Packages */}
        <div className="container mx-auto px-4 pb-8">
          <div className="max-w-7xl mx-auto grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {peptidePackages.map(pkg => {
              const currentPrice = getPrice(pkg)
              const savings = pkg.price - currentPrice
              
              return (
                <div 
                  key={pkg.id} 
                  className={`relative bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl border shadow-xl hover:shadow-primary-400/20 transition-all duration-300 ${
                    pkg.popular 
                      ? 'border-secondary-400/50 ring-2 ring-secondary-400/30 scale-105' 
                      : 'border-primary-400/30'
                  }`}
                >
                  {pkg.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-gradient-to-r from-secondary-500 to-secondary-600 text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg">
                        Most Popular
                      </span>
                    </div>
                  )}

                  <div className="p-6">
                    {/* Package Header */}
                    <div className="text-center mb-6">
                      <h3 className="text-2xl font-bold text-white mb-2">{pkg.name}</h3>
                      <p className="text-gray-300 text-sm leading-relaxed">{pkg.description}</p>
                    </div>

                    {/* Pricing */}
                    <div className="text-center mb-6">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <span className="text-4xl font-bold text-white">${Math.round(currentPrice)}</span>
                        {pkg.originalPrice && (
                          <span className="text-lg text-gray-400 line-through">${pkg.originalPrice}</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-300">
                        {pkg.duration} • {(currentPrice / parseInt(pkg.duration)).toFixed(1)}$/day
                      </div>
                      {isSubscription && savings > 0 && (
                        <div className="text-green-400 text-sm font-medium mt-1">
                          Save ${Math.round(savings)} with subscription
                        </div>
                      )}
                    </div>

                    {/* Peptides Included */}
                    <div className="mb-6">
                      <h4 className="font-semibold text-primary-300 mb-3 text-sm">Peptides Included</h4>
                      <div className="space-y-2">
                        {pkg.peptides.map((peptide, idx) => (
                          <div key={idx} className="flex items-center text-sm text-gray-200">
                            <Check className="w-4 h-4 text-green-400 mr-2 flex-shrink-0" />
                            <span>{peptide}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Features */}
                    <div className="mb-6">
                      <h4 className="font-semibold text-primary-300 mb-3 text-sm">What's Included</h4>
                      <div className="space-y-2">
                        {pkg.features.map((feature, idx) => (
                          <div key={idx} className="flex items-center text-sm text-gray-200">
                            <Check className="w-4 h-4 text-secondary-400 mr-2 flex-shrink-0" />
                            <span>{feature}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Expected Results */}
                    <div className="mb-6">
                      <h4 className="font-semibold text-amber-300 mb-3 text-sm">Expected Results</h4>
                      <div className="space-y-1">
                        {pkg.results.map((result, idx) => (
                          <div key={idx} className="flex items-center text-sm text-gray-200">
                            <Star className="w-3 h-3 text-amber-400 mr-2 flex-shrink-0" />
                            <span>{result}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Order Button */}
                    <button
                      onClick={() => handleOrderClick(pkg.id)}
                      className={`w-full font-bold py-4 px-4 rounded-lg transition-all duration-300 hover:scale-105 shadow-lg backdrop-blur-sm border ${
                        pkg.popular
                          ? 'bg-gradient-to-br from-secondary-500/80 to-secondary-600/80 hover:from-secondary-400/90 hover:to-secondary-500/90 text-white border border-secondary-400/30 hover:shadow-secondary-400/20'
                          : 'bg-gradient-to-br from-primary-500/80 to-primary-600/80 hover:from-primary-400/90 hover:to-primary-500/90 text-white border border-primary-400/30 hover:shadow-primary-400/20'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <ShoppingCart className="w-5 h-5" />
                        <span>Order Now</span>
                      </div>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Additional Info */}
          <div className="max-w-4xl mx-auto mt-12 grid gap-6 md:grid-cols-3">
            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 shadow-xl text-center">
              <Shield className="w-8 h-8 text-green-400 mx-auto mb-3" />
              <h4 className="font-semibold text-white mb-2">Medical Grade</h4>
              <p className="text-sm text-gray-300">All peptides are pharmacy-grade and third-party tested for purity.</p>
            </div>
            
            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 shadow-xl text-center">
              <Clock className="w-8 h-8 text-blue-400 mx-auto mb-3" />
              <h4 className="font-semibold text-white mb-2">Fast Shipping</h4>
              <p className="text-sm text-gray-300">Cold-chain shipping ensures peptides arrive fresh and potent.</p>
            </div>
            
            <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 shadow-xl text-center">
              <RefreshCw className="w-8 h-8 text-primary-400 mx-auto mb-3" />
              <h4 className="font-semibold text-white mb-2">Success Guarantee</h4>
              <p className="text-sm text-gray-300">Not satisfied? Get your money back within 30 days.</p>
            </div>
          </div>

          {/* Individual Peptides Section */}
          <div className="mt-16">
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                <span className="text-primary-400">Individual</span> Peptides
              </h2>
              <p className="text-xl text-gray-200 max-w-2xl mx-auto">
                Build your own protocol with our selection of research-grade peptides
              </p>
            </div>

            <div className="max-w-7xl mx-auto grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {individualPeptides.map(peptide => (
                <div 
                  key={peptide.id}
                  className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-6 border border-primary-400/30 shadow-xl hover:shadow-primary-400/20 transition-all duration-300"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-white">{peptide.name}</h3>
                      <span className="text-sm text-gray-300">{peptide.amount}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white">${peptide.price}</div>
                      {!peptide.inStock && (
                        <span className="text-xs text-red-400 flex items-center gap-1 mt-1">
                          <AlertCircle className="w-3 h-3" />
                          Out of stock
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-300 mb-4">{peptide.description}</p>
                  
                  <div className="space-y-1 mb-4">
                    {peptide.benefits.map((benefit, idx) => (
                      <div key={idx} className="flex items-center text-xs text-gray-200">
                        <Check className="w-3 h-3 text-green-400 mr-2 flex-shrink-0" />
                        <span>{benefit}</span>
                      </div>
                    ))}
                  </div>
                  
                  <button
                    disabled={!peptide.inStock}
                    className={`w-full font-bold py-3 px-4 rounded-lg transition-all duration-300 ${
                      peptide.inStock
                        ? 'bg-gradient-to-br from-primary-500/80 to-primary-600/80 hover:from-primary-400/90 hover:to-primary-500/90 text-white border border-primary-400/30 hover:shadow-primary-400/20 hover:scale-105 shadow-lg backdrop-blur-sm'
                        : 'bg-gray-600/50 text-gray-400 border border-gray-500/30 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <ShoppingCart className="w-4 h-4" />
                      <span>{peptide.inStock ? 'Order Now' : 'Out of Stock'}</span>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Checkout Modal */}
      {showCheckout && selectedPkg && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-md rounded-xl p-6 border border-primary-400/30 shadow-2xl max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">Order Summary</h3>
            
            <div className="space-y-4 mb-6">
              <div className="flex justify-between">
                <span className="text-gray-300">Package:</span>
                <span className="text-white font-medium">{selectedPkg.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Duration:</span>
                <span className="text-white">{selectedPkg.duration}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Delivery:</span>
                <span className="text-white">{isSubscription ? 'Monthly' : 'One-time'}</span>
              </div>
              <div className="border-t border-gray-600/30 pt-4">
                <div className="flex justify-between text-lg font-bold">
                  <span className="text-white">Total:</span>
                  <span className="text-secondary-400">${Math.round(getPrice(selectedPkg))}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button className="w-full bg-gradient-to-br from-secondary-500/80 to-secondary-600/80 hover:from-secondary-400/90 hover:to-secondary-500/90 text-white font-bold py-3 px-4 rounded-lg transition-all backdrop-blur-sm border border-secondary-400/30 flex items-center justify-center gap-2">
                <CreditCard className="w-5 h-5" />
                <span>Proceed to Checkout</span>
              </button>
              
              <button 
                onClick={() => setShowCheckout(false)}
                className="w-full bg-gray-600/80 hover:bg-gray-500/80 text-white font-medium py-3 px-4 rounded-lg transition-colors"
              >
                Continue Shopping
              </button>
            </div>

            <p className="text-xs text-gray-400 text-center mt-4">
              Secure checkout powered by Stripe • 256-bit SSL encryption
            </p>
          </div>
        </div>
      )}
    </div>
  )
}