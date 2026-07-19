import { NextResponse } from 'next/server';

const WGER_API_BASE = 'https://wger.de/api/v2/exerciseinfo/';
const ENGLISH_LANGUAGE_ID = 2;

// F4.5: verified live against https://wger.de/api/v2/exerciseinfo/ (2026-07-18)
// -- `search` and `language` are BOTH silently ignored on this endpoint
// (identical `count` with or without them; `language=1` vs `language=2`
// returned the same mixed-language rows). `exercise-translation?name=` is
// exact-match only ("Bench" -> 0 results, "Bench Press" -> 1), so it can't
// power a type-ahead either. Exercise names never lived at `item.name` --
// they're in `item.translations[]`, one row per language.
// Fix: pull the whole catalog once (module-level cache, same seed-once shape
// as ensureCuratedWorkoutProtocols) and match client-side against the
// English translation name. 844 exercises total as of this writing.
// ponytail: process-lifetime cache, no TTL -- WGER's catalog changes rarely;
// restart the process to pick up newly added exercises.
let catalogPromise: Promise<any[]> | null = null;

const fetchCatalog = async (): Promise<any[]> => {
  const url = new URL(WGER_API_BASE);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '2000'); // comfortably above the current 844-exercise count

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`WGER API responded with status ${res.status}`);
  }

  const data = await res.json();
  return Array.isArray(data?.results) ? data.results : [];
};

const getCatalog = async (): Promise<any[]> => {
  if (!catalogPromise) {
    catalogPromise = fetchCatalog().catch((err) => {
      catalogPromise = null; // allow a later request to retry instead of caching a rejection
      throw err;
    });
  }
  return catalogPromise;
};

const englishTranslation = (item: any) => {
  const translations = Array.isArray(item?.translations) ? item.translations : [];
  return translations.find((t: any) => t?.language === ENGLISH_LANGUAGE_ID) ?? null;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || !query.trim()) {
      return NextResponse.json({ ok: true, items: [] });
    }

    const term = query.trim().toLowerCase();
    const limitParam = Number(searchParams.get('limit'));
    const offsetParam = Number(searchParams.get('offset'));
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 20;
    const offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? offsetParam : 0;

    const catalog = await getCatalog();

    const matched = catalog.filter((item) => {
      const translation = englishTranslation(item);
      return typeof translation?.name === 'string' && translation.name.toLowerCase().includes(term);
    });

    const page = matched.slice(offset, offset + limit);

    const items = page.map((item: any) => {
      const translation = englishTranslation(item);
      return {
        id: item?.id,
        name: translation?.name ?? 'Unknown exercise',
        category: item?.category?.name ?? 'General',
        description: translation?.description ?? '',
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
      };
    });

    return NextResponse.json({ ok: true, items, total: matched.length });
  } catch (error: any) {
    console.error('GET /api/workouts/search error', error);
    return NextResponse.json({ ok: false, error: error?.message ?? 'Unable to search workouts right now.' }, { status: 500 });
  }
}
