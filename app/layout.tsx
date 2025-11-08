import type { ReactNode } from 'react';
import Script from 'next/script';
import { Header } from '@/components/Navigation/Header';
import { ClientAuth0Provider } from '@/components/Auth/ClientAuth0Provider';
import './globals.css';

export const metadata = { title: 'ResetBiology' };

export default function RootLayout({ children }: { children: ReactNode }) {
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
        <ClientAuth0Provider>
          <Header />
          {children}
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
