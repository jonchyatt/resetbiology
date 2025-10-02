export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';
import { auth0 } from '@/lib/auth0';
import { NutritionTracker } from '@/components/Nutrition/NutritionTracker';

export default async function NutritionPage() {
  const session = await auth0.getSession();
  if (!session?.user) redirect('/auth/login?returnTo=%2Fportal%2Fnutrition');
  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold mb-4">Nutrition</h1>
      <NutritionTracker />
    </main>
  );
}

