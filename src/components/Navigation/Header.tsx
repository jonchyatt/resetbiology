import Link from 'next/link';

export default function Header() {
  return (
    <header className="p-4">
      <nav className="flex gap-4">
        <Link href="/">Home</Link>
        <Link href="/portal">Portal</Link>
        <a href="/api/auth/login">Sign in</a>
        <a href="/api/auth/logout">Sign out</a>
      </nav>
    </header>
  );
}