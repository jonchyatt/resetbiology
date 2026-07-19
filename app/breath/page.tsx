"use client"

import { BreathPage } from "@/components/Breath/BreathPage"
import { VaultPromptModal } from "@/components/Vault/VaultPromptModal"

export default function BreathPageRoute() {
  return (
    <>
      <VaultPromptModal trackerName="Breath Sessions" trackerVerb="save your breath session history" />
      <BreathPage />
    </>
  )
}
