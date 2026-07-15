import Link from "next/link"
import { ArrowLeft, FileText, Mail } from "lucide-react"

export const metadata = {
  title: "Terms of Service - Reset Biology",
  description: "Terms of Service for the Reset Biology peptide therapy and metabolic health coaching platform.",
}

const sections = [
  { id: "acceptance", label: "Acceptance of Terms" },
  { id: "the-service", label: "The Service" },
  { id: "not-medical-advice", label: "Not Medical Advice" },
  { id: "accounts", label: "Account Responsibilities" },
  { id: "acceptable-use", label: "Acceptable Use" },
  { id: "vault-integration", label: "Google Drive Vault Integration" },
  { id: "payments", label: "Payments & Subscriptions" },
  { id: "intellectual-property", label: "Intellectual Property" },
  { id: "termination", label: "Termination" },
  { id: "disclaimers", label: "Disclaimers" },
  { id: "liability", label: "Limitation of Liability" },
  { id: "governing-law", label: "Governing Law" },
  { id: "changes", label: "Changes to These Terms" },
  { id: "contact", label: "Contact Us" },
]

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600/20 to-secondary-600/20 backdrop-blur-sm border-b border-primary-400/30">
        <div className="container mx-auto px-4 py-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-primary-300 hover:text-primary-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Title */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 text-primary-400 font-medium mb-4">
              <FileText className="w-5 h-5" />
              <span>Terms of Service</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Terms of <span className="text-primary-400">Service</span>
            </h1>
            <p className="text-gray-400">Last updated: July 14, 2026</p>
          </div>

          {/* Table of contents */}
          <nav className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-md border border-gray-600/30 rounded-2xl p-6 mb-10">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3">On this page</h2>
            <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="text-primary-300 hover:text-primary-200 transition-colors text-sm">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Content */}
          <div className="space-y-10 text-gray-300 leading-relaxed">
            <section id="acceptance">
              <h2 className="text-2xl font-bold text-white mb-3">Acceptance of Terms</h2>
              <p>
                These Terms of Service ("Terms") govern your access to and use
                of the Reset Biology website, portal, and related applications
                (collectively, the "Service"), operated by Reset Biology
                ("Reset Biology," "we," "us," or "our"). By creating an
                account or otherwise using the Service, you agree to these
                Terms. If you do not agree, do not use the Service.
              </p>
              {/* entity form deliberately unstated — no RB legal entity documented; Satori Enterprises d/b/a link unverified (entity-specialist 2026-07-15) */}
            </section>

            <section id="the-service">
              <h2 className="text-2xl font-bold text-white mb-3">The Service</h2>
              <p>
                Reset Biology is a licensed medical provider-led, IRB-approved
                research program and coaching platform focused on peptide
                therapy and metabolic health. The Service includes
                educational content, guided training modules (breath,
                vision, workout, nutrition), a client portal, an optional
                Google Drive Vault integration for exporting your own data,
                and AI-assisted coaching features.
              </p>
            </section>

            <section id="not-medical-advice">
              <h2 className="text-2xl font-bold text-white mb-3">Not Medical Advice</h2>
              <div className="bg-gradient-to-br from-amber-900/20 to-amber-800/10 border border-amber-400/30 rounded-2xl p-6">
                <p>
                  The Service, including any educational content, research
                  summaries, protocol descriptions, and AI-generated coaching
                  responses, is provided for informational and educational
                  purposes as part of an IRB-approved research protocol. It is{" "}
                  <strong className="text-white">not a substitute for
                  individualized medical advice, diagnosis, or treatment</strong>{" "}
                  from your own qualified healthcare provider. Peptide therapy
                  and related protocols carry individual risks; always consult
                  your licensed medical provider before starting, stopping, or
                  changing any therapy, medication, or dosing regimen, and
                  before making decisions based on content from the Service.
                  If you believe you are experiencing a medical emergency,
                  call 911 or your local emergency number immediately.
                </p>
              </div>
            </section>

            <section id="accounts">
              <h2 className="text-2xl font-bold text-white mb-3">Account Responsibilities</h2>
              <ul className="list-disc list-inside space-y-2">
                <li>You must provide accurate information when creating your account and keep it up to date.</li>
                <li>You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account.</li>
                <li>You must notify us promptly at <a href="mailto:support@resetbiology.com" className="text-primary-300 hover:text-primary-200 underline">support@resetbiology.com</a> of any unauthorized use of your account.</li>
                <li>You must be at least 18 years old to create an account.</li>
              </ul>
            </section>

            <section id="acceptable-use">
              <h2 className="text-2xl font-bold text-white mb-3">Acceptable Use</h2>
              <p className="mb-3">When using the Service, you agree not to:</p>
              <ul className="list-disc list-inside space-y-2">
                <li>Use the Service for any unlawful purpose or in violation of any applicable regulation.</li>
                <li>Attempt to gain unauthorized access to other users' accounts or data, or to any part of the Service's infrastructure.</li>
                <li>Reverse engineer, scrape, or interfere with the normal operation of the Service.</li>
                <li>Upload content that is fraudulent, defamatory, or infringes on the rights of others.</li>
                <li>Share your account credentials with, or grant portal access to, anyone else without our authorization.</li>
              </ul>
              <p className="mt-3">
                We may suspend or terminate accounts that violate this section.
              </p>
            </section>

            <section id="vault-integration">
              <h2 className="text-2xl font-bold text-white mb-3">Google Drive Vault Integration</h2>
              <p>
                The Service offers an optional integration that syncs your
                program data to a folder our application creates in your own
                Google Drive, described in full in our{" "}
                <Link href="/privacy" className="text-primary-300 hover:text-primary-200 underline">
                  Privacy Policy
                </Link>
                . Connecting this integration is optional, governed by Google's
                own terms of service in addition to these Terms, and may be
                disconnected by you at any time. We are not responsible for
                the availability, performance, or policies of Google's
                services.
              </p>
            </section>

            <section id="payments">
              <h2 className="text-2xl font-bold text-white mb-3">Payments & Subscriptions</h2>
              <p>
                Certain features of the Service require payment. Fees are
                disclosed to you before you are charged. Payments are
                processed by our third-party payment processor. Except where
                required by law or explicitly stated at time of purchase,
                fees are non-refundable.
              </p>
            </section>

            <section id="intellectual-property">
              <h2 className="text-2xl font-bold text-white mb-3">Intellectual Property</h2>
              <p>
                The Service, including its software, design, educational
                content, and research summaries, is owned by Reset Biology or
                its licensors and is protected by intellectual property laws.
                You retain ownership of the personal data and content you
                submit (journal entries, logs, etc.). We grant you a limited,
                non-exclusive, non-transferable license to access and use the
                Service for your personal, non-commercial use.
              </p>
            </section>

            <section id="termination">
              <h2 className="text-2xl font-bold text-white mb-3">Termination</h2>
              <p>
                You may stop using the Service and close your account at any
                time by contacting{" "}
                <a href="mailto:support@resetbiology.com" className="text-primary-300 hover:text-primary-200 underline">
                  support@resetbiology.com
                </a>
                . We may suspend or terminate your access to the Service if
                you violate these Terms, or for legitimate operational,
                security, or legal reasons, with notice where reasonably
                practicable. Sections of these Terms that by their nature
                should survive termination (including Intellectual Property,
                Disclaimers, and Limitation of Liability) will survive.
              </p>
            </section>

            <section id="disclaimers">
              <h2 className="text-2xl font-bold text-white mb-3">Disclaimers</h2>
              <p>
                The Service is provided "as is" and "as available" without
                warranties of any kind, whether express or implied, including
                implied warranties of merchantability, fitness for a
                particular purpose, and non-infringement. We do not warrant
                that the Service will be uninterrupted, error-free, or free
                of harmful components, or that any particular health outcome
                will result from use of the Service.
              </p>
            </section>

            <section id="liability">
              <h2 className="text-2xl font-bold text-white mb-3">Limitation of Liability</h2>
              <p>
                To the fullest extent permitted by law, Reset Biology and its
                officers, employees, and licensed providers will not be
                liable for any indirect, incidental, special, consequential,
                or punitive damages, or any loss of data, profits, or
                goodwill, arising out of or related to your use of the
                Service. Our total liability for any claim arising from these
                Terms or the Service will not exceed the amount you paid to
                Reset Biology in the twelve months preceding the claim.
              </p>
              {/* attorney review required before paid or clinically-relied-upon use — board condition flw-consult-14, 2026-07-15 */}
            </section>

            <section id="governing-law">
              <h2 className="text-2xl font-bold text-white mb-3">Governing Law</h2>
              <p>
                These Terms are governed by the laws of the State of Utah,
                USA, without regard to its conflict of laws principles, and
                you agree to the exclusive jurisdiction of the state and
                federal courts located in Utah for any disputes arising from
                these Terms.
              </p>
            </section>

            <section id="changes">
              <h2 className="text-2xl font-bold text-white mb-3">Changes to These Terms</h2>
              <p>
                We may update these Terms from time to time. We will post the
                updated Terms on this page with a revised "Last updated" date.
                Continued use of the Service after changes take effect
                constitutes acceptance of the updated Terms. Material changes
                will be communicated via email or in-app notice where
                appropriate.
              </p>
            </section>

            <section id="contact">
              <h2 className="text-2xl font-bold text-white mb-3">Contact Us</h2>
              <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-md border border-gray-600/30 rounded-2xl p-6">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-primary-400" />
                  <p>
                    Questions about these Terms? Email{" "}
                    <a href="mailto:support@resetbiology.com" className="text-primary-300 hover:text-primary-200 underline">
                      support@resetbiology.com
                    </a>
                    .
                  </p>
                </div>
              </div>
            </section>
          </div>

          {/* Related links */}
          <div className="mt-12 text-center">
            <div className="flex flex-wrap gap-4 justify-center">
              <Link
                href="/privacy"
                className="bg-secondary-500/20 border border-secondary-400/40 text-secondary-300 px-6 py-3 rounded-lg hover:bg-secondary-500/30 transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                href="/contact"
                className="bg-primary-500/20 border border-primary-400/40 text-primary-300 px-6 py-3 rounded-lg hover:bg-primary-500/30 transition-colors"
              >
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
