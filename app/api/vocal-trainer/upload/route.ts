// POST /api/vocal-trainer/upload
// Body: multipart/form-data with `audio` (File) and `template` (JSON string)
// Saves both to Vercel Blob under vocal-trainer/<id>/
import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';

export const runtime = 'nodejs';
export const maxDuration = 60;

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'untitled';
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const audio = form.get('audio') as File | null;
    const templateJson = form.get('template') as string | null;

    if (!templateJson) {
      return NextResponse.json({ error: 'template (JSON) is required' }, { status: 400 });
    }

    let template: any;
    try {
      template = JSON.parse(templateJson);
    } catch {
      return NextResponse.json({ error: 'template is not valid JSON' }, { status: 400 });
    }

    const title: string = template.title || (audio?.name || 'untitled').replace(/\.[^.]+$/, '');
    const id = `${Date.now()}-${slugify(title)}`;
    const baseKey = `vocal-trainer/${id}`;

    let audioUrl: string | null = null;
    let audioContentType: string | null = null;
    if (audio) {
      const audioBlob = await put(`${baseKey}/audio${pickExt(audio.name)}`, audio, {
        access: 'public',
        contentType: audio.type || 'audio/mp4',
        addRandomSuffix: false,
      });
      audioUrl = audioBlob.url;
      audioContentType = audio.type || null;
    }

    // Patch the template with id + audio reference, then save
    const fullTemplate = {
      ...template,
      id,
      title,
      audioUrl,
      audioContentType,
      createdAt: new Date().toISOString(),
    };

    const tplBlob = await put(`${baseKey}/template.json`, JSON.stringify(fullTemplate, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });

    return NextResponse.json({ success: true, id, template: fullTemplate, templateUrl: tplBlob.url });
  } catch (err) {
    console.error('[vocal-trainer/upload] error:', err);
    return NextResponse.json({
      error: 'upload failed',
      details: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}

// PUT /api/vocal-trainer/upload — overwrite an existing template (no audio re-upload)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body?.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const baseKey = `vocal-trainer/${body.id}`;
    const updated = { ...body, updatedAt: new Date().toISOString() };
    const tplBlob = await put(`${baseKey}/template.json`, JSON.stringify(updated, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return NextResponse.json({ success: true, template: updated, templateUrl: tplBlob.url });
  } catch (err) {
    console.error('[vocal-trainer/upload PUT] error:', err);
    return NextResponse.json({
      error: 'update failed',
      details: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}

function pickExt(name: string): string {
  const m = name.match(/\.[a-z0-9]+$/i);
  return m ? m[0] : '.m4a';
}
