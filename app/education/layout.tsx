import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Education',
  description: 'Free peptide, breath and metabolic-health education: guides, studies and practitioner notes. Nothing for sale.',
};

export default function EducationLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
