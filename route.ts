import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  const banners = await prisma.heroBanner.findMany({ orderBy: { sortOrder: 'asc' } });
  return NextResponse.json({ banners });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  const b = await req.json();
  const banner = await prisma.heroBanner.create({
    data: {
      eyebrow: String(b.eyebrow || 'WHOLESALE PROMO').trim(),
      title: String(b.title || '').trim(),
      subtitle: String(b.subtitle || '').trim(),
      ctaLabel: String(b.ctaLabel || 'Browse Catalog').trim(),
      ctaHref: String(b.ctaHref || '#catalog').trim(),
      imageUrl: String(b.imageUrl || '/images/hero-warehouse.jpg').trim(),
      badgeText: String(b.badgeText || 'BULK DEALS').trim(),
      sortOrder: Number(b.sortOrder || 0),
      active: b.active !== false,
    },
  });
  return NextResponse.json({ banner }, { status: 201 });
}

export async function PUT(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  const b = await req.json();
  const banner = await prisma.heroBanner.update({
    where: { id: String(b.id) },
    data: {
      eyebrow: String(b.eyebrow || '').trim(),
      title: String(b.title || '').trim(),
      subtitle: String(b.subtitle || '').trim(),
      ctaLabel: String(b.ctaLabel || 'Browse Catalog').trim(),
      ctaHref: String(b.ctaHref || '#catalog').trim(),
      imageUrl: String(b.imageUrl || '/images/hero-warehouse.jpg').trim(),
      badgeText: String(b.badgeText || '').trim(),
      sortOrder: Number(b.sortOrder || 0),
      active: Boolean(b.active),
    },
  });
  return NextResponse.json({ banner });
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Banner id required.' }, { status: 400 });
  await prisma.heroBanner.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
