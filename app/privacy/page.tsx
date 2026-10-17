import Link from "next/link"
import OperatorLine from "@/components/Legal/OperatorLine"
import { ArrowLeft, Shield, Mail } from "lucide-react"

export const metadata = {
  title: "Privacy Policy",
  description: "How Reset Biology, a free wellness-tracking and education service, collects, stores and shares your data, including our optional Google Drive integration.",
}

const sections = [
  { id: "overview", label: "Overview" },
  { id: "information-we-collect", label: "Information We Collect" },
  { id: "google-drive-vault", label: "Your Google Drive copy" },
  { id: "how-we-use-information", label: "How We Use Your Information" },
  { id: "ai-coaching", label: "AI Coaching & Your Google Drive Data" },
  { id: "cookies", label: "Cookies & Analytics" },
  { id: "storage-security", label: "Data Storage & Security" },
  { id: "sharing", label: "Data Sharing" },
  { id: "limited-use", label: "Google Limited Use Disclosure" },
  { id: "your-choices", label: "Your Rights & Choices" },
  { id: "retention", label: "Data Retention" },
  { id: "children", label: "Who Can Sign Up" },
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
            <p className="text-gray-400">Last updated: October 14, 2026</p>
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
                Reset Biology ("Reset Biology," "we," "us," or "our") runs a
                free wellness-tracking and education service at
                resetbiology.com (the "Service"). Reset Biology does not sell
                anything on this site and does not take payment. This Privacy
                Policy explains what we collect, where it is stored, which
                outside services handle it, and your choices, including our
                optional Google Drive integration, which Google reviews as
                part of our app verification.
              </p>
              {/* entity form deliberately unstated — no RB legal entity documented; Satori Enterprises d/b/a link unverified (entity-specialist 2026-07-15) */}
              <OperatorLine />
            </section>

            <section id="information-we-collect">
              <h2 className="text-2xl font-bold text-white mb-3">Information We Collect</h2>
              <ul className="space-y-3">
                <li>
                  <strong className="text-white">What you tell us when you start.</strong>{" "}
                  On the Get Started page you give us a name, your email address, what you want to focus on, and the page that sent you. We save this before you create an account, so your portal is ready when you sign in.
                </li>
                <li>
                  <strong className="text-white">Account information.</strong>{" "}
                  Sign-in is handled by Auth0. If you choose “Continue with Google,” Google shares your name, email address and profile photo with Auth0, which passes them to us. We never see or store your password. On your first sign-in we create a member record with your email, name, photo, sign-in ID and a member number.
                </li>
                <li>
                  <strong className="text-white">What you enter.</strong>{" "}
                  Journal entries, meals, workouts, check-ins, breath, vision and memory-training sessions, guided-audio completions, daily tasks, peptide and medication protocols and doses, and reminder settings.
                </li>
                <li>
                  <strong className="text-white">Progress photos.</strong>{" "}
                  Only if you connect Google Drive. They are stored in your Drive, not in our database.
                </li>
                <li>
                  <strong className="text-white">Voice, chat and uploads.</strong>{" "}
                  When you talk to a voice coach, your audio and messages are sent to OpenAI to be transcribed and answered. When you type in the chat on a peptide research page, your text is sent to Cloudflare’s AI service. Recordings you choose to upload to the Vocal Trainer are stored with Vercel Blob at a web address that anyone who has the link can open.
                </li>
                <li>
                  <strong className="text-white">Notifications.</strong>{" "}
                  If you turn on browser notifications, we store the delivery address your browser gives us. Email reminders can name the peptide you are tracking.
                </li>
                <li>
                  <strong className="text-white">Technical data.</strong>{" "}
                  Our sign-in provider checks your session on each page you visit. We do not use analytics, advertising or tracking scripts.
                </li>
              </ul>
            </section>

            <section id="google-drive-vault">
              <h2 className="text-2xl font-bold text-white mb-3">Your Google Drive copy</h2>
              <div className="bg-gradient-to-br from-primary-900/30 to-secondary-900/30 border border-primary-400/30 rounded-2xl p-6 mb-4">
                <p className="text-white font-medium">
                  Your data is yours. Everything you log is saved in your
                  Reset Biology account. Connect Google Drive and we also keep
                  a copy in a folder you own. This app can only touch files it
                  created, and cannot see the rest of your Drive. Disconnect
                  any time; your files stay yours.
                </p>
              </div>
              <p className="mb-3">
                Reset Biology offers an optional Google Drive feature that lets you
                sync your own program data — journal entries, nutrition logs,
                workout summaries, breath and vision-training sessions, and
                peptide/medication dosing records — to a folder named "Reset
                Biology Data" in <strong className="text-white">your own Google Drive</strong>,
                so you keep your own copy that you can open, download and take
                with you.
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
                <strong className="text-white">How we use it.</strong> About
                every five minutes we copy your new journal, workout,
                nutrition-tracker, dose, breath, vision and memory-training
                records to the folder we created. Progress photos are saved
                only there. Connecting Drive is optional: every tracker,
                protocol and reminder works without it.
              </p>
            </section>

            <section id="how-we-use-information">
              <h2 className="text-2xl font-bold text-white mb-3">How We Use Your Information</h2>
              <ul className="list-disc list-inside space-y-2">
                <li>To provide, operate, and maintain the Service, including your coaching plan and portal.</li>
                <li>To personalize your program based on the data you provide.</li>
                <li>To communicate with you about your account, program updates, and support requests.</li>
                <li>To maintain the security and integrity of the Service.</li>
              </ul>
              <p className="mt-3">
                We do not use your health or program data for advertising, and
                we do not sell your personal information.
              </p>
            </section>

            <section id="ai-coaching">
              <h2 className="text-2xl font-bold text-white mb-3">AI Coaching & Your Google Drive Data</h2>
              <p>
                Our voice coaches can tailor their answers to your own
                history. If you have connected Google Drive, a coach reads the
                files our app created in your Drive, a shortened summary is
                sent to OpenAI, and the answer comes back to you. Coaches
                never open files our app did not create. If you have not
                connected Drive, coaches answer without your history.
              </p>
            </section>

            <section id="cookies">
              <h2 className="text-2xl font-bold text-white mb-3">Cookies & Analytics</h2>
              <p>
                We use only the cookies needed to keep you signed in, set by
                our sign-in provider, Auth0. We do not use advertising
                cookies, analytics or tracking pixels. If that changes, we
                will update this policy first.
              </p>
            </section>

            <section id="storage-security">
              <h2 className="text-2xl font-bold text-white mb-3">Data Storage & Security</h2>
              <p className="mb-3">
                Your account and everything you enter are stored in our
                database (MongoDB), whether or not you connect Google Drive.
                That is what lets the app work on every device. If you connect
                Drive, a copy also goes to the folder our app creates in your
                Drive. The sign-in keys that let us write to your Drive are
                stored{" "}
                <strong className="text-white">encrypted (AES-256-GCM)</strong>;
                the app refuses to store them any other way.
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
                <li>With the services that run the Service for us: Auth0 (sign-in), Google (only if you connect Drive or sign in with Google), Vercel (hosting and Vocal Trainer uploads), our database host (MongoDB), OpenAI (voice coaches), Cloudflare (peptide-page chat), Resend (emails), your browser&apos;s push service (notifications), and USDA FoodData Central and Open Food Facts (your food searches).</li>
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
                  <strong className="text-white">Disconnect your Google Drive anytime</strong> from
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
                  . Disconnecting stops new copies. Files already in your Drive
                  stay yours and we never delete them, and your Reset Biology
                  account keeps working the same.
                </li>
                <li>Download a copy of your data, or delete your data, yourself from your Profile page (Download my data, Delete my data).</li>
                <li>Request a copy of the personal data we hold about you.</li>
                <li>Request correction of inaccurate data.</li>
                <li>Request deletion of your account and the data you entered.</li>
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
                We keep your account data while your account is open. When
                you ask us to delete your account, we delete your account and
                the records you entered from our database. Files in your own
                Google Drive are yours; we never delete them.
              </p>
            </section>

            <section id="children">
              <h2 className="text-2xl font-bold text-white mb-3">Who Can Sign Up</h2>
              <p>
                Anyone can create an account. We don&apos;t ask your age and
                don&apos;t check it, because nothing is sold on this site. The
                Service is not designed for children under 13, and we do not
                knowingly collect personal information from a child under 13.
                If you are a parent or guardian and believe your child under 13
                has an account, email{" "}
                <a href="mailto:support@resetbiology.com" className="text-primary-300 hover:text-primary-200 underline">
                  support@resetbiology.com
                </a>{" "}
                and we will delete it.
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
