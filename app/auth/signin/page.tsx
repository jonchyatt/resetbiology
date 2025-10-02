import { SignInButton } from "@/components/Auth/SignInButton"

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <img
            className="mx-auto h-12 w-auto"
            src="/reset-logo-pro.png"
            alt="Reset Biology"
          />
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Welcome to Reset Biology
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to access your personalized portal and start your journey to metabolic freedom.
          </p>
        </div>

        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="space-y-6">
            <div>
              <SignInButton className="w-full justify-center text-sm font-medium" />
            </div>
            
            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">What you get with Reset Biology</span>
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-4 text-sm text-gray-600">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="h-5 w-5 rounded-full bg-teal-100 flex items-center justify-center">
                    <svg className="h-3 w-3 text-teal-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <div>
                  <p className="font-medium text-gray-900">IRB-Approved Protocols</p>
                  <p>Access to legal, monitored peptide therapy programs</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="h-5 w-5 rounded-full bg-teal-100 flex items-center justify-center">
                    <svg className="h-3 w-3 text-teal-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Mental Mastery System</p>
                  <p>30+ audio modules for lasting behavioral change</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="h-5 w-5 rounded-full bg-teal-100 flex items-center justify-center">
                    <svg className="h-3 w-3 text-teal-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Partner Rewards System</p>
                  <p>Earn back your investment plus bonuses for success</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="h-5 w-5 rounded-full bg-teal-100 flex items-center justify-center">
                    <svg className="h-3 w-3 text-teal-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Comprehensive Tracking</p>
                  <p>Breath training, progress monitoring, and analytics</p>
                </div>
              </div>
            </div>

            <div className="mt-6 text-center">
              <p className="text-xs text-gray-500">
                By signing in, you agree to our terms of service and privacy policy.
                <br />
                Your data is secured with Google's enterprise-grade security.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}