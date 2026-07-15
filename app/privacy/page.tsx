import Link from "next/link"
import { ArrowLeft, Shield, Mail } from "lucide-react"

export const metadata = {
  title: "Privacy Policy - Reset Biology",
  description: "How Reset Biology collects, uses, and protects your data, including our Google Drive Vault integration.",
}

const sections = [
  { id: "overview", label: "Overview" },
  { id: "information-we-collect", label: "Information We Collect" },
  { id: "google-drive-vault", label: "The Google Drive Vault" },
  { id: "how-we-use-information", label: "How We Use Your Information" },
  { id: "ai-coaching", label: "AI Coaching & Your Vault Data" },
  { id: "cookies", label: "Cookies & Analytics" },
  { id: "storage-security", label: "Data Storage & Security" },
  { id: "sharing", label: "Data Sharing" },
  { id: "limited-use", label: "Google Limited Use Disclosure" },
  { id: "your-choices", label: "Your Rights & Choices" },
  { id: "retention", label: "Data Retention" },
  { id: "children", label: "Children's Privacy" },
  { id: "changes", label: "Changes to This Policy" },
  { id: "contact", label: "Contact Us" },
]

export default function PrivacyPolicyPage() {
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
              <Shield className="w-5 h-5" />
              <span>Privacy Policy</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Your Data, <span className="text-primary-400">Your Ownership</span>
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
            <section id="overview">
              <h2 className="text-2xl font-bold text-white mb-3">Overview</h2>
              <p>
                Reset Biology ("Reset Biology," "we," "us," or "our") operates a
                licensed medical provider-led, IRB-approved peptide therapy and
                metabolic health coaching platform at resetbiology.com (the
                "Service"). This Privacy Policy explains what information we
                collect, how we use it, how we store it, and the choices you
                have — including a dedicated section on our optional Google
                Drive integration, since that integration is reviewed directly
                by Google as part of our OAuth verification.
              </p>
              {/* JON-CONFIRM: confirm "Reset Biology" is the correct legal entity name to use throughout this policy, or provide the registered legal entity name if different. */}
            </section>

            <section id="information-we-collect">
              <h2 className="text-2xl font-bold text-white mb-3">Information We Collect</h2>
              <ul className="space-y-3">
                <li>
                  <strong className="text-white">Account information.</strong>{" "}
                  We use Auth0 to handle sign-in. When you create an account we
                  receive your name, email address, and authentication
                  identifiers from Auth0. We do not store your password — Auth0
                  handles that.
                </li>
                <li>
                  <strong className="text-white">Health and program data you enter.</strong>{" "}
                  Journal entries, nutrition logs, workout summaries, breath
                  and vision-training session results, peptide and medication
                  dosing records, quiz and assessment answers, and any other
                  information you enter into the app.
                </li>
                <li>
                  <strong className="text-white">Payment information.</strong>{" "}
                  Payments are processed by our third-party payment processor;
                  Reset Biology does not store full credit card numbers.
                </li>
                <li>
                  <strong className="text-white">Usage data.</strong>{" "}
                  Standard technical data such as pages visited within the
                  app, session timestamps, and device/browser information
                  needed to operate the Service.
                </li>
              </ul>
            </section>

            <section id="google-drive-vault">
              <h2 className="text-2xl font-bold text-white mb-3">The Google Drive Vault</h2>
              <div className="bg-gradient-to-br from-primary-900/30 to-secondary-900/30 border border-primary-400/30 rounded-2xl p-6 mb-4">
                <p className="text-white font-medium">
                  Your data lives in your Google Drive — we ship the app, you
                  own the data. This app can only touch files it created; it
                  cannot see the rest of your Drive. Disconnect anytime — your
                  files stay yours.
                </p>
              </div>
              <p className="mb-3">
                Reset Biology offers an optional "Vault" feature that lets you
                sync your own program data — journal entries, nutrition logs,
                workout summaries, breath and vision-training sessions, and
                peptide/medication dosing records — to a folder named "Reset
                Biology Data" in <strong className="text-white">your own Google Drive</strong>,
                so you retain a personal, exportable copy of your data outside
                our servers.
              </p>
              <p className="mb-3">
                <strong className="text-white">What we access.</strong> We use
                the Google Drive API with the <code className="text-primary-300">drive.file</code> scope,
                which limits our application to files and folders{" "}
                <strong className="text-white">our application itself creates</strong> in
                your Drive. We cannot see, read, modify, or delete any other
                file already in your Google Drive. We additionally request
                your Google account email address (via the{" "}
                <code className="text-primary-300">userinfo.email</code> scope)
                solely to label the folder we create and confirm which account
                is connected.
              </p>
              <p>
                <strong className="text-white">How we use it.</strong> Data is
                written to the folder we create only when you take an action
                in the Reset Biology app (logging a workout, a meal, a peptide
                dose, a journal entry, etc.). Connecting the Vault is entirely
                optional — the Service works without it.
              </p>
            </section>

            <section id="how-we-use-information">
              <h2 className="text-2xl font-bold text-white mb-3">How We Use Your Information</h2>
              <ul className="list-disc list-inside space-y-2">
                <li>To provide, operate, and maintain the Service, including your coaching plan and portal.</li>
                <li>To personalize your program based on the data you provide.</li>
                <li>To communicate with you about your account, program updates, and support requests.</li>
                <li>To maintain the security and integrity of the Service.</li>
                <li>To comply with legal and regulatory obligations related to our IRB-approved research protocol.</li>
              </ul>
              <p className="mt-3">
                We do not use your health or program data for advertising, and
                we do not sell your personal information.
              </p>
            </section>

            <section id="ai-coaching">
              <h2 className="text-2xl font-bold text-white mb-3">AI Coaching & Your Vault Data</h2>
              <p>
                Reset Biology's AI coaching features are designed to give you
                personalized guidance based on your own program history. When
                you use an AI coaching feature and you have connected your
                Google Drive Vault, our coaching agents may read data from{" "}
                <strong className="text-white">files our application created
                in your Drive</strong> — the same journal, nutrition, workout,
                and dosing records described above — in order to personalize
                the guidance you receive. This access is limited to files our
                app created (the same <code className="text-primary-300">drive.file</code> scope
                described above); our AI coaching features never access files
                elsewhere in your Drive that our app did not create. If you
                have not connected the Vault, AI coaching draws only on the
                data stored in your Reset Biology account.
              </p>
            </section>

            <section id="cookies">
              <h2 className="text-2xl font-bold text-white mb-3">Cookies & Analytics</h2>
              <p>
                We use essential cookies to keep you signed in and to maintain
                your session through our authentication provider (Auth0). As
                of the effective date of this policy, Reset Biology does not
                use third-party advertising cookies or third-party tracking
                pixels on the Service. If that changes, we will update this
                policy.
              </p>
            </section>

            <section id="storage-security">
              <h2 className="text-2xl font-bold text-white mb-3">Data Storage & Security</h2>
              <p className="mb-3">
                Your program data is stored in our database (MongoDB) so the
                app can function. When you connect the Google Drive Vault, a
                copy of the same data is also written to the Drive folder our
                app creates for you. OAuth refresh tokens used to write to
                your Drive are stored{" "}
                <strong className="text-white">encrypted using AES-256-GCM</strong>.
              </p>
              <p>
                We use reasonable administrative, technical, and physical
                safeguards designed to protect your information. No method of
                electronic storage or transmission is 100% secure, and we
                cannot guarantee absolute security.
              </p>
            </section>

            <section id="sharing">
              <h2 className="text-2xl font-bold text-white mb-3">Data Sharing</h2>
              <p>
                We do not sell your personal information, and we do not share
                it with third parties, except:
              </p>
              <ul className="list-disc list-inside space-y-2 mt-3">
                <li>With service providers who help us operate the Service (e.g., hosting, payment processing, authentication) under confidentiality obligations.</li>
                <li>With licensed medical providers involved in your care under our IRB-approved protocol.</li>
                <li>When required by law, regulation, legal process, or governmental request.</li>
                <li>To protect the rights, property, or safety of Reset Biology, our users, or the public.</li>
              </ul>
            </section>

            <section id="limited-use">
              <h2 className="text-2xl font-bold text-white mb-3">Google Limited Use Disclosure</h2>
              <p>
                Reset Biology's use and transfer of information received from
                Google APIs to any other app will adhere to the{" "}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-300 hover:text-primary-200 underline"
                >
                  Google API Services User Data Policy
                </a>
                , including the Limited Use requirements. We only request the
                minimum Google Drive scope (<code className="text-primary-300">drive.file</code>)
                needed to create and update files our app creates for you, and
                we do not use Google user data for advertising.
              </p>
            </section>

            <section id="your-choices">
              <h2 className="text-2xl font-bold text-white mb-3">Your Rights & Choices</h2>
              <ul className="list-disc list-inside space-y-2">
                <li>
                  <strong className="text-white">Disconnect the Vault anytime</strong> from
                  Profile → Privacy → Google Drive Sync, or by revoking access
                  directly at{" "}
                  <a
                    href="https://myaccount.google.com/permissions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-300 hover:text-primary-200 underline"
                  >
                    myaccount.google.com/permissions
                  </a>
                  . Disconnecting stops future syncs; files already written to
                  your Drive remain yours and are not deleted by us.
                </li>
                <li>Request a copy of the personal data we hold about you.</li>
                <li>Request correction of inaccurate data.</li>
                <li>Request deletion of your account and associated data, subject to any records we are required to retain for regulatory or medical-recordkeeping reasons.</li>
              </ul>
              <p className="mt-3">
                To exercise any of these choices, contact us at{" "}
                <a href="mailto:support@resetbiology.com" className="text-primary-300 hover:text-primary-200 underline">
                  support@resetbiology.com
                </a>
                .
              </p>
            </section>

            <section id="retention">
              <h2 className="text-2xl font-bold text-white mb-3">Data Retention</h2>
              <p>
                We retain your information for as long as your account is
                active or as needed to provide the Service, comply with our
                legal and regulatory obligations under our IRB-approved
                research protocol, resolve disputes, and enforce our
                agreements.
              </p>
              {/* JON-CONFIRM: confirm exact record-retention period required under the IRB protocol / applicable medical-recordkeeping regulations, if a specific number of years should be stated here. */}
            </section>

            <section id="children">
              <h2 className="text-2xl font-bold text-white mb-3">Children's Privacy</h2>
              <p>
                The Service is intended for adults and is not directed to
                individuals under 18. We do not knowingly collect personal
                information from children under 18.
              </p>
            </section>

            <section id="changes">
              <h2 className="text-2xl font-bold text-white mb-3">Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will
                post the updated policy on this page with a revised "Last
                updated" date. Material changes will be communicated via
                email or in-app notice where appropriate.
              </p>
            </section>

            <section id="contact">
              <h2 className="text-2xl font-bold text-white mb-3">Contact Us</h2>
              <div className="bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-md border border-gray-600/30 rounded-2xl p-6">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-primary-400" />
                  <p>
                    Questions about this policy or your data? Email{" "}
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
                href="/terms"
                className="bg-secondary-500/20 border border-secondary-400/40 text-secondary-300 px-6 py-3 rounded-lg hover:bg-secondary-500/30 transition-colors"
              >
                Terms of Service
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
