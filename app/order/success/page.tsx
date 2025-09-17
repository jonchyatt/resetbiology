export default async function SuccessPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  const sessionId = params['session_id'];
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-2">Payment successful</h1>
      <p className="text-gray-600">Thank you! Your session id is {sessionId}.</p>
    </main>
  );
}