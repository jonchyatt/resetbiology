"use client"

import { useState } from "react"
import { Check, ChevronLeft, Star, MessageCircle, Award } from "lucide-react"
import { nepqConfig, NEPQOffer } from "@/config/nepqQuizConfig"
import { NEPQAnswers } from "./NEPQQuiz"

interface NEPQCloseProps {
  answers: NEPQAnswers
  auditScore: {
    score: number
    maxScore: number
    percentage: number
    level: "beginner" | "intermediate" | "advanced" | "expert"
  }
  onSelect: (offerId: string | null) => void
  onBack: () => void
}

/**
 * NEPQ Close Component
 *
 * Uses Chris Voss "No-oriented" questioning for low-pressure close
 * Shows offer cards with pricing and CTA
 */
export function NEPQClose({ answers, auditScore, onSelect, onBack }: NEPQCloseProps) {
  const [stage, setStage] = useState<"commitment" | "offers">("commitment")
  const [selectedOffer, setSelectedOffer] = useState<string | null>(null)
  const [otherRequest, setOtherRequest] = useState("")

  const { closeQuestion, offers } = nepqConfig

  // Get personalized recommendation based on audit level
  const getRecommendedOffer = (): string => {
    switch (auditScore.level) {
      case "beginner":
        return "guided" // They need more support
      case "intermediate":
        return "guided"
      case "advanced":
        return "diy" // They can handle DIY
      case "expert":
        return "diy"
      default:
        return "guided"
    }
  }

  const recommendedOfferId = getRecommendedOffer()

  // Handle commitment question response
  const handleCommitmentResponse = (wantsToSee: boolean) => {
    if (wantsToSee) {
      setStage("offers")
    } else {
      // They said they're not ready - still show offers but with different framing
      setStage("offers")
    }
  }

  // Handle offer selection
  const handleOfferSelect = (offer: NEPQOffer) => {
    setSelectedOffer(offer.id)
  }

  // Handle final submission
  const handleSubmit = () => {
    onSelect(selectedOffer)
  }

  // Get accent color classes
  const getAccentClasses = (color: NEPQOffer["accentColor"], isSelected: boolean) => {
    const baseClasses = {
      teal: {
        border: isSelected ? "border-teal-400" : "border-teal-400/30",
        bg: isSelected ? "from-teal-500/20 to-teal-600/10" : "from-teal-500/5 to-teal-600/5",
        badge: "bg-teal-500",
        button: "from-teal-500 to-teal-600",
      },
      blue: {
        border: isSelected ? "border-blue-400" : "border-blue-400/30",
        bg: isSelected ? "from-blue-500/20 to-blue-600/10" : "from-blue-500/5 to-blue-600/5",
        badge: "bg-blue-500",
        button: "from-blue-500 to-blue-600",
      },
      purple: {
        border: isSelected ? "border-purple-400" : "border-purple-400/30",
        bg: isSelected ? "from-purple-500/20 to-purple-600/10" : "from-purple-500/5 to-purple-600/5",
        badge: "bg-purple-500",
        button: "from-purple-500 to-purple-600",
      },
      gold: {
        border: isSelected ? "border-yellow-400" : "border-yellow-400/30",
        bg: isSelected ? "from-yellow-500/20 to-yellow-600/10" : "from-yellow-500/5 to-yellow-600/5",
        badge: "bg-yellow-500",
        button: "from-yellow-500 to-yellow-600",
      },
      gray: {
        border: isSelected ? "border-gray-400" : "border-gray-400/30",
        bg: isSelected ? "from-gray-500/20 to-gray-600/10" : "from-gray-500/5 to-gray-600/5",
        badge: "bg-gray-500",
        button: "from-gray-500 to-gray-600",
      },
    }
    return baseClasses[color]
  }

  // Commitment question stage
  if (stage === "commitment") {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4 py-8"
        style={{
          backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        }}
      >
        <div className="max-w-2xl mx-auto w-full">
          {/* Profile Summary Card */}
          <div className="mb-8 bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-6 border border-primary-400/20 shadow-lg">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-lg flex items-center justify-center">
                <Award className="w-5 h-5 text-white" />
              </div>
              Your Profile Summary
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-700/30 rounded-lg p-4">
                <span className="text-gray-400 text-sm block mb-1">Practice Level</span>
                <span className="text-white font-semibold text-lg capitalize">{auditScore.level}</span>
              </div>
              <div className="bg-gray-700/30 rounded-lg p-4">
                <span className="text-gray-400 text-sm block mb-1">Foundation Score</span>
                <span className="text-primary-400 font-semibold text-lg">{auditScore.percentage}%</span>
              </div>
              <div className="bg-gray-700/30 rounded-lg p-4">
                <span className="text-gray-400 text-sm block mb-1">Current Stage</span>
                <span className="text-white font-semibold text-lg capitalize">
                  {answers.journey_stage.replace(/_/g, " ")}
                </span>
              </div>
              <div className="bg-gray-700/30 rounded-lg p-4">
                <span className="text-gray-400 text-sm block mb-1">Readiness</span>
                <span className="text-secondary-400 font-semibold text-lg">{answers.readiness_scale}/10</span>
              </div>
            </div>
          </div>

          {/* Question Card */}
          <div className="bg-gradient-to-br from-primary-600/20 to-secondary-600/20 backdrop-blur-sm rounded-xl p-8 border border-primary-400/30 shadow-2xl text-center">
            {/* No-oriented question */}
            <div className="mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                {closeQuestion.question}
              </h2>
              <p className="text-gray-300 text-lg">
                Based on your profile, we have some options that might help you reach your goals.
              </p>
            </div>

            {/* Response buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => handleCommitmentResponse(true)}
                className="px-8 py-4 bg-gradient-to-r from-primary-500 to-secondary-500 text-white rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-primary-500/30 transition-all hover:scale-105"
              >
                {closeQuestion.yesText}
              </button>
              <button
                onClick={() => handleCommitmentResponse(false)}
                className="px-8 py-4 bg-gray-700/50 text-gray-300 rounded-xl font-medium text-lg hover:bg-gray-600/50 transition-all border border-gray-600"
              >
                {closeQuestion.noText}
              </button>
            </div>

            {/* Back button */}
            <button
              onClick={onBack}
              className="mt-8 text-gray-400 hover:text-white transition-colors flex items-center gap-2 mx-auto"
            >
              <ChevronLeft className="w-4 h-4" />
              Go back
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Offers stage
  return (
    <div
      className="min-h-screen px-4 py-8 md:py-12"
      style={{
        backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Choose Your Path Forward
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Every option includes a trial period. Pick what feels right for where you are now.
          </p>
        </div>

        {/* Offer Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
          {offers.slice(0, 4).map((offer) => {
            const isSelected = selectedOffer === offer.id
            const isRecommended = offer.id === recommendedOfferId
            const colors = getAccentClasses(offer.accentColor, isSelected)

            return (
              <div
                key={offer.id}
                onClick={() => handleOfferSelect(offer)}
                className={`relative cursor-pointer rounded-2xl border-2 ${colors.border} bg-gradient-to-br ${colors.bg} p-6 transition-all hover:scale-[1.02] ${
                  isSelected ? "ring-2 ring-white/20 shadow-xl" : ""
                } ${offer.highlighted ? "lg:scale-105" : ""}`}
              >
                {/* Badges */}
                <div className="absolute -top-3 left-4 flex gap-2">
                  {offer.badge && (
                    <span className={`${colors.badge} text-white text-xs font-bold px-3 py-1 rounded-full`}>
                      {offer.badge}
                    </span>
                  )}
                  {isRecommended && (
                    <span className="bg-secondary-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                      <Star className="w-3 h-3" />
                      For You
                    </span>
                  )}
                </div>

                {/* Selection indicator */}
                {isSelected && (
                  <div className="absolute top-4 right-4 w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}

                {/* Content */}
                <div className="mt-4">
                  <h3 className="text-xl font-bold text-white mb-1">{offer.title}</h3>
                  <p className="text-gray-400 text-sm mb-4">{offer.subtitle}</p>

                  {/* Pricing */}
                  <div className="mb-4">
                    <span className="text-3xl font-bold text-white">{offer.trialPrice}</span>
                    <span className="text-gray-400 text-sm ml-2">trial</span>
                    <div className="text-gray-500 text-sm">then {offer.monthlyPrice}</div>
                  </div>

                  {/* Features */}
                  <ul className="space-y-2">
                    {offer.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                        <Check className="w-4 h-4 text-primary-400 flex-shrink-0 mt-0.5" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )
          })}

          {/* "Other" option */}
          {offers.find(o => o.tier === "other") && (
            <div
              onClick={() => handleOfferSelect(offers.find(o => o.tier === "other")!)}
              className={`cursor-pointer rounded-2xl border-2 ${
                selectedOffer === "other" ? "border-gray-400" : "border-gray-600/50"
              } bg-gray-800/30 p-6 transition-all hover:border-gray-500 ${
                selectedOffer === "other" ? "ring-2 ring-white/10" : ""
              }`}
            >
              <div className="flex items-center gap-3 mb-4">
                <MessageCircle className="w-8 h-8 text-gray-400" />
                <div>
                  <h3 className="text-lg font-bold text-white">Something Else?</h3>
                  <p className="text-gray-400 text-sm">Let's figure it out together</p>
                </div>
              </div>

              {selectedOffer === "other" && (
                <textarea
                  value={otherRequest}
                  onChange={(e) => setOtherRequest(e.target.value)}
                  placeholder="Tell us what would work better for you..."
                  className="w-full mt-4 px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  rows={3}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="text-center">
          <button
            onClick={handleSubmit}
            disabled={!selectedOffer}
            className={`px-12 py-4 rounded-xl font-bold text-lg transition-all ${
              selectedOffer
                ? "bg-gradient-to-r from-primary-500 to-secondary-500 text-white hover:shadow-lg hover:shadow-primary-500/30 hover:scale-105"
                : "bg-gray-700 text-gray-500 cursor-not-allowed"
            }`}
          >
            {selectedOffer === "other"
              ? "Submit Request"
              : selectedOffer === "concierge"
              ? "Book Your Call"
              : selectedOffer
              ? "Start Your Trial"
              : "Select an Option"}
          </button>

          {/* Skip option */}
          <button
            onClick={() => onSelect(null)}
            className="block mx-auto mt-4 text-gray-500 hover:text-gray-300 text-sm transition-colors"
          >
            I need more time to think
          </button>
        </div>

        {/* Back button */}
        <button
          onClick={onBack}
          className="mt-8 text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-2 mx-auto"
        >
          <ChevronLeft className="w-4 h-4" />
          Go back
        </button>
      </div>
    </div>
  )
}

export default NEPQClose
