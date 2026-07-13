// One-shot verification: anon (no session) request to vocal-trainer upload/delete routes → 401.
// Run: npx tsx scripts/verify-vocal-trainer-auth.mjs
import { NextRequest } from 'next/server';

async function main() {
  const { POST, PUT } = await import('../app/api/vocal-trainer/upload/route.ts');
  const { DELETE } = await import('../app/api/vocal-trainer/delete/route.ts');

  const results = [];

  const postReq = new NextRequest('http://localhost/api/vocal-trainer/upload', {
    method: 'POST',
    body: new FormData(),
  });
  const postRes = await POST(postReq);
  results.push(['POST /api/vocal-trainer/upload', postRes.status]);

  const putReq = new NextRequest('http://localhost/api/vocal-trainer/upload', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 'test' }),
  });
  const putRes = await PUT(putReq);
  results.push(['PUT /api/vocal-trainer/upload', putRes.status]);

  const delReq = new NextRequest('http://localhost/api/vocal-trainer/delete?id=test', {
    method: 'DELETE',
  });
  const delRes = await DELETE(delReq);
  results.push(['DELETE /api/vocal-trainer/delete', delRes.status]);

  // Tampered/invalid session cookie must also fail closed to 401, not leak a 500.
  const tamperedHeaders = { cookie: 'appSession=not-a-real-encrypted-session-value' };
  const postTamperedRes = await POST(new NextRequest('http://localhost/api/vocal-trainer/upload', {
    method: 'POST',
    headers: tamperedHeaders,
    body: new FormData(),
  }));
  results.push(['POST (tampered cookie)', postTamperedRes.status]);

  const delTamperedRes = await DELETE(new NextRequest('http://localhost/api/vocal-trainer/delete?id=test', {
    method: 'DELETE',
    headers: tamperedHeaders,
  }));
  results.push(['DELETE (tampered cookie)', delTamperedRes.status]);

  let allPass = true;
  for (const [label, status] of results) {
    const pass = status === 401;
    allPass = allPass && pass;
    console.log(`${pass ? 'PASS' : 'FAIL'} — ${label} → ${status} (expected 401)`);
  }
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error('verify script error:', err);
  process.exit(1);
});
