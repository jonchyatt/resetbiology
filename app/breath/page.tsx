"use client"
import { SameBuilderRow } from "@/components/Outbound/SameBuilderRow"

import { EmailCaptureCard } from "@/components/Newsletter/EmailCaptureCard"
import { BreathPage } from "@/components/Breath/BreathPage"
import { VaultPromptModal } from "@/components/Vault/VaultPromptModal"

export default function BreathPageRoute() {
  return (
    <>
      <VaultPromptModal trackerName="Breath Sessions" trackerVerb="save your breath session history" />
      <BreathPage />
      <EmailCaptureCard source="tool-breath" />
      <SameBuilderRow />
    </>
  )
}
