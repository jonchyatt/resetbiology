// src/components/Navigation/Header.tsx
import Link from 'next/link';
import AuthButtons from './AuthButtons';

export default function Header() {
  return (
    <header className="p-4">
      <nav className="flex items-center gap-4">
        <Link href="/">Home</Link>
        <Link href="/portal">Portal</Link>
        {/* Session-aware buttons (Login or Sign out + Portal) */}
        {/* This renders server-side and is safe in App Router */}
        {/* If styling uses a wrapper/right-aligned area, keep it consistent */}
        <AuthButtons />
      </nav>
    </header>
  );
}