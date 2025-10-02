'use client';
export default function ErrorPage({ error }: { error: Error }) {
  return (
    <main className="max-w-3xl mx-auto px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-gray-600 mt-2">{error?.message || 'Unknown error'}</p>
      <a href="/" className="inline-block mt-6 px-4 py-2 rounded bg-black text-white">Go home</a>
    </main>
  );
}

