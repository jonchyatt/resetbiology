"use client"

import { BreathPage } from "@/components/Breath/BreathPage"
import { ProtectedRoute } from "@/components/Auth/ProtectedRoute"
import { VaultPromptModal } from "@/components/Vault/VaultPromptModal"

export default function BreathPageRoute() {
  return (
    <ProtectedRoute>
      <VaultPromptModal trackerName="Breath Sessions" trackerVerb="save your breath session history" />
      <BreathPage />
    </ProtectedRoute>
  )
}