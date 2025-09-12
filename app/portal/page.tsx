// app/portal/page.tsx
import { auth0 } from '@/lib/auth0';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function PortalPage() {
  const session = await auth0.getSession();
  if (!session?.user) redirect('/api/auth/login');

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Your Portal</h1>
      <p className="mt-2">Signed in as {session.user.email}</p>

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <a href="/portal/peptides" className="block p-4 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 transition-colors">
          <h3 className="font-semibold text-primary-800">Peptides</h3>
          <p className="text-sm text-primary-600 mt-1">Manage your peptide tracking</p>
        </a>
        <a href="/portal/nutrition" className="block p-4 bg-secondary-50 border border-secondary-200 rounded-lg hover:bg-secondary-100 transition-colors">
          <h3 className="font-semibold text-secondary-800">Nutrition</h3>
          <p className="text-sm text-secondary-600 mt-1">Track your meals and macros</p>
        </a>
        <a href="/portal/workouts" className="block p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
          <h3 className="font-semibold text-blue-800">Workouts</h3>
          <p className="text-sm text-blue-600 mt-1">Plan and track workouts</p>
        </a>
        <a href="/portal/education" className="block p-4 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors">
          <h3 className="font-semibold text-purple-800">Education</h3>
          <p className="text-sm text-purple-600 mt-1">Learn and grow</p>
        </a>
      </div>

      <div className="mt-8">
        <a href="/api/auth/logout" className="underline text-gray-600 hover:text-gray-800">Sign out</a>
      </div>
    </main>
  );
}