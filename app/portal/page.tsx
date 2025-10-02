export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';
import { auth0 } from '@/lib/auth0';

export default async function PortalHome() {
  const session = await auth0.getSession();
  if (!session?.user) redirect('/auth/login?returnTo=%2Fportal');

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold">Your Homebase</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <a href="/portal/nutrition" className="border rounded p-4 hover:bg-gray-50">
          <div className="font-medium">Nutrition</div>
          <div className="text-sm text-gray-600">Log foods & view recent</div>
        </a>
        <a href="/portal/workouts" className="border rounded p-4 hover:bg-gray-50">
          <div className="font-medium">Workouts</div>
          <div className="text-sm text-gray-600">Log sessions & estimate kcal</div>
        </a>
        <a href="/portal/peptides" className="border rounded p-4 hover:bg-gray-50">
          <div className="font-medium">Peptides</div>
          <div className="text-sm text-gray-600">Protocols and tracking</div>
        </a>
        <a href="/portal/education" className="border rounded p-4 hover:bg-gray-50">
          <div className="font-medium">Education</div>
          <div className="text-sm text-gray-600">Modules & progress</div>
        </a>
        <a href="/portal/orders" className="border rounded p-4 hover:bg-gray-50">
          <div className="font-medium">Orders & Billing</div>
          <div className="text-sm text-gray-600">View purchases (Stripe)</div>
        </a>
      </div>
    </main>
  );
}

