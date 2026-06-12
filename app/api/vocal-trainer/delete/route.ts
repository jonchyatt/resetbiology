// DELETE /api/vocal-trainer/delete?id=<templateId>
// Removes a template's blobs (audio + template.json) from Vercel Blob.
import { NextRequest, NextResponse } from 'next/server';
import { list, del } from '@vercel/blob';

export const runtime = 'nodejs';

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    if (!id || !/^[a-z0-9-]+$/i.test(id)) {
      return NextResponse.json({ error: 'valid id required' }, { status: 400 });
    }
    const prefix = `vocal-trainer/${id}/`;
    const res = await list({ prefix, limit: 100 });
    if (res.blobs.length === 0) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    await del(res.blobs.map(b => b.url));
    return NextResponse.json({ deleted: id, blobs: res.blobs.length });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
