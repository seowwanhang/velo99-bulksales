import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  const regions = await prisma.deliveryRegion.findMany({ orderBy: { sortOrder: 'asc' } });
  return NextResponse.json({ regions });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  const b = await req.json();
  const code = String(b.code || b.name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const region = await prisma.deliveryRegion.create({
    data: {
      code: code || `zone-${Date.now()}`,
      name: String(b.name || '').trim(),
      states: String(b.states || '').trim(),
      hubName: String(b.hubName || '').trim(),
      hubAddress: String(b.hubAddress || '').trim(),
      postcodePrefix: String(b.postcodePrefix || '40000').trim(),
      pickupHours: String(b.pickupHours || '6:00 PM - 10:00 PM').trim(),
      sortOrder: Number(b.sortOrder || 0),
      active: b.active !== false,
    },
  });
  return NextResponse.json({ region }, { status: 201 });
}

export async function PUT(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  const b = await req.json();
  const region = await prisma.deliveryRegion.update({
    where: { id: String(b.id) },
    data: {
      name: String(b.name || '').trim(),
      states: String(b.states || '').trim(),
      hubName: String(b.hubName || '').trim(),
      hubAddress: String(b.hubAddress || '').trim(),
      postcodePrefix: String(b.postcodePrefix || '40000').trim(),
      pickupHours: String(b.pickupHours || '6:00 PM - 10:00 PM').trim(),
      sortOrder: Number(b.sortOrder || 0),
      active: Boolean(b.active),
    },
  });
  return NextResponse.json({ region });
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Region id required.' }, { status: 400 });
  await prisma.deliveryRegion.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
