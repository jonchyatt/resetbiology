export default function HomePage() {
  return (
    <main className="max-w-6xl mx-auto px-4 py-12">
      <section className="text-center py-16">
        <h1 className="text-4xl font-bold">ResetBiology</h1>
        <p className="text-gray-600 mt-3">Evidence-based peptides, nutrition, and performance protocols.</p>
        <div className="mt-6 flex items-center justify-center gap-4">
          <a href="/order" className="px-4 py-2 rounded bg-black text-white">Order Now</a>
          <a href="/portal" className="px-4 py-2 rounded border">Go to Portal</a>
        </div>
      </section>
    </main>
  );
}

