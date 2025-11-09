"use client"

import { BreathTrainingApp } from "@/components/Breath/BreathTrainingApp"
import SubscriptionGate from "@/components/Subscriptions/SubscriptionGate"

export default function BreathPage() {
  return (
    <SubscriptionGate featureName="Breathing App">
      <BreathTrainingApp />
    </SubscriptionGate>
  )
}