import Link from 'next/link';
export default function Header() {
  return (
    <header className="w-full border-b">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-semibold">ResetBiology</Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/peptides">Peptides</Link>
          <Link href="/education">Education</Link>
          <Link href="/order">Order</Link>
          <Link href="/portal">Portal</Link>
          <a href="/auth/login" className="ml-3">Login</a>
          <a href="/auth/logout">Sign out</a>
        </nav>
      </div>
    </header>
  );
}

