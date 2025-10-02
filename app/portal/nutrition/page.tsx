import { redirect } from 'next/navigation';
import { auth0 } from '@/lib/auth0';
import NutritionTracker from '@/components/Nutrition/NutritionTracker';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function Page() {
  const session = await auth0.getSession();
  if (!session?.user) redirect('/auth/login');
  return (
    <main className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Nutrition</h1>
      <NutritionTracker />
    </main>
  );
}
