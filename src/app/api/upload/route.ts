import { NextResponse } from 'next/server';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

const ALLOWED_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};
const MAX_BYTES = 3 * 1024 * 1024; // 3MB

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No image file uploaded.' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Image must be smaller than 3 MB.' }, { status: 400 });
    }

    const ext = path.extname(file.name).toLowerCase() || '.jpg';
    const mimeType = ALLOWED_MIME[ext];
    if (!mimeType) {
      return NextResponse.json(
        { error: 'Only JPG, PNG, WEBP, and GIF images are supported.' },
        { status: 400 }
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const asset = await prisma.uploadedAsset.create({
      data: {
        filename: file.name.slice(0, 120),
        mimeType,
        data: Buffer.from(bytes),
      },
      select: { id: true },
    });

    return NextResponse.json({ url: `/api/assets/${asset.id}` }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Image upload failed.' }, { status: 500 });
  }
}
