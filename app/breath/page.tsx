"use client"

import { BreathPage } from "@/components/Breath/BreathPage"
import SubscriptionGate from "@/components/Subscriptions/SubscriptionGate"
import { VaultPromptModal } from "@/components/Vault/VaultPromptModal"

export default function BreathPageRoute() {
  return (
    <SubscriptionGate featureName="Breathing App">
      <VaultPromptModal trackerName="Breath Sessions" trackerVerb="save your breath session history" />
      <BreathPage />
    </SubscriptionGate>
  )
}