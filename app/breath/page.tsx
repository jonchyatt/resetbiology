"use client"

import { BreathPage } from "@/components/Breath/BreathPage"
import SubscriptionGate from "@/components/Subscriptions/SubscriptionGate"

export default function BreathPageRoute() {
  return (
    <SubscriptionGate featureName="Breathing App">
      <BreathPage />
    </SubscriptionGate>
  )
}