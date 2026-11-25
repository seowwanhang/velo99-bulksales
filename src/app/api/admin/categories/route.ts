import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { products: true } } },
  });
  return NextResponse.json({ categories });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  const b = await req.json();
  const slug = String(b.slug || b.name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const category = await prisma.category.create({
    data: {
      slug: slug || `cat-${Date.now()}`,
      name: String(b.name || '').trim(),
      description: String(b.description || '').trim(),
      imageUrl: String(b.imageUrl || '/images/bike-mtb.jpg').trim(),
      sortOrder: Number(b.sortOrder || 0),
      active: b.active !== false,
    },
  });
  return NextResponse.json({ category }, { status: 201 });
}

export async function PUT(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  const b = await req.json();
  const category = await prisma.category.update({
    where: { id: String(b.id) },
    data: {
      name: String(b.name || '').trim(),
      description: String(b.description || '').trim(),
      imageUrl: String(b.imageUrl || '/images/bike-mtb.jpg').trim(),
      sortOrder: Number(b.sortOrder || 0),
      active: Boolean(b.active),
    },
  });
  return NextResponse.json({ category });
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Category id required.' }, { status: 400 });
  const count = await prisma.product.count({ where: { categoryId: id } });
  if (count > 0) {
    return NextResponse.json(
      { error: `Cannot delete category with ${count} linked product(s). Reassign or delete products first.` },
      { status: 400 }
    );
  }
  await prisma.category.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
