import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString('base64');

    // Upload to Imgur (anonymous upload - no API key needed for basic use)
    const imgurResponse = await fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: {
        'Authorization': 'Client-ID 546c25a59c58ad7', // Public anonymous client ID
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: base64Image,
        type: 'base64'
      })
    });

    const imgurData = await imgurResponse.json();

    if (!imgurData.success) {
      console.error('Imgur upload failed:', imgurData);
      return NextResponse.json({
        error: 'Failed to upload to Imgur',
        details: imgurData
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      url: imgurData.data.link,
      deleteHash: imgurData.data.deletehash
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    return NextResponse.json({
      error: 'Failed to upload image',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
