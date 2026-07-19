import type { ReactNode } from 'react';
import Script from 'next/script';
import { Header } from '@/components/Navigation/Header';
import { Footer } from '@/components/Navigation/Footer';
import { ClientAuth0Provider } from '@/components/Auth/ClientAuth0Provider';
import { ToastProvider } from '@/components/ui/Toast';
import { auth0 } from '@/lib/auth0';
import './globals.css';

export const metadata = { title: 'ResetBiology' };

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Server-side session read so Auth0Provider can seed useUser()'s SWR cache
  // with the initial user on first paint — without this the client hook
  // never resolves an authenticated user (see ClientAuth0Provider.tsx).
  const session = await auth0.getSession();

  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3FBFB5" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>
        {/* iOS Safe Area Status Bar Cover - prevents page content from showing behind status bar */}
        <div
          className="fixed top-0 left-0 right-0 z-[9999] bg-slate-900 pointer-events-none"
          style={{ height: 'env(safe-area-inset-top, 0px)' }}
          aria-hidden="true"
        />
        <ClientAuth0Provider user={session?.user}>
<ToastProvider>
            <Header />
            {children}
            <Footer />
          </ToastProvider>
        </ClientAuth0Provider>

        <Script id="register-sw" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.register('/service-worker.js')
                .then(reg => console.log('SW registered:', reg))
                .catch(err => console.log('SW registration failed:', err))
            }
          `}
        </Script>
      </body>
    </html>
  );
}
