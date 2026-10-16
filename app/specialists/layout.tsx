import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Specialists',
  description: 'Chat with a Reset Biology specialist (members).',
  robots: { index: false },
};

export default function SpecialistsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
