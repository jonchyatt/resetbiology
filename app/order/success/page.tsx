export default function SuccessPage({ searchParams }: { searchParams: Record<string, string> }) {
  const sessionId = searchParams['session_id'];
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-2">Payment successful</h1>
      <p className="text-gray-600">Thank you! Your session id is {sessionId}.</p>
    </main>
  );
}