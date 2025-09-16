import type { ReactNode } from 'react';
import { Header } from '@/components/Navigation/Header';
import { ClientAuth0Provider } from '@/components/Auth/ClientAuth0Provider';
import './globals.css';

export const metadata = { title: 'ResetBiology' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClientAuth0Provider>
          <Header />
          {children}
        </ClientAuth0Provider>
      </body>
    </html>
  );
}