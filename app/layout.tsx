import type { ReactNode } from 'react';
import { Header } from '@/components/Navigation/Header';
import './globals.css';

export const metadata = { title: 'ResetBiology' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Header />
        {children}
      </body>
    </html>
  );
}