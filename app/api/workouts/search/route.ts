import { NextResponse } from 'next/server';

const WGER_API_BASE = 'https://wger.de/api/v2/exerciseinfo/';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || !query.trim()) {
      return NextResponse.json({ ok: true, items: [] });
    }

    const url = new URL(WGER_API_BASE);
    url.searchParams.set('language', '2'); // English results
    url.searchParams.set('limit', searchParams.get('limit') ?? '20');
    url.searchParams.set('offset', searchParams.get('offset') ?? '0');
    url.searchParams.set('search', query.trim());

    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`WGER API responded with status ${res.status}`);
    }

    const data = await res.json();
    const items = Array.isArray(data?.results)
      ? data.results.map((item: any) => ({
          id: item?.id,
          name: item?.name ?? 'Unknown exercise',
          category: item?.category?.name ?? 'General',
          description: item?.description ?? '',
          primaryMuscles: Array.isArray(item?.muscles)
            ? item.muscles.map((muscle: any) => muscle?.name).filter(Boolean)
            : [],
          secondaryMuscles: Array.isArray(item?.muscles_secondary)
            ? item.muscles_secondary.map((muscle: any) => muscle?.name).filter(Boolean)
            : [],
          equipment: Array.isArray(item?.equipment)
            ? item.equipment.map((eq: any) => eq?.name).filter(Boolean)
            : [],
          image: Array.isArray(item?.images) && item.images.length > 0 ? item.images[0]?.image : null,
        }))
      : [];

    return NextResponse.json({ ok: true, items, total: data?.count ?? items.length });
  } catch (error: any) {
    console.error('GET /api/workouts/search error', error);
    return NextResponse.json({ ok: false, error: error?.message ?? 'Unable to search workouts right now.' }, { status: 500 });
  }
}
