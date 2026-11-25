import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  const products = await prisma.product.findMany({
    orderBy: [{ createdAt: 'desc' }],
    include: { category: { select: { id: true, name: true, slug: true } } },
  });
  return NextResponse.json({ products });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  try {
    const b = await req.json();
    const sku = String(b.sku || '').trim().toUpperCase();
    const name = String(b.name || '').trim();
    if (!sku || !name || !b.categoryId) {
      return NextResponse.json({ error: 'SKU, Name, and Category are required.' }, { status: 400 });
    }

    const stock = Math.max(0, Math.floor(Number(b.stock ?? 0)));
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          sku,
          name,
          categoryId: String(b.categoryId),
          color: String(b.color || 'Standard').trim(),
          size: String(b.size || 'One Size').trim(),
          unitsPerCarton: Math.max(1, Math.floor(Number(b.unitsPerCarton ?? 1))),
          isBicycle: b.isBicycle !== false,
          cbm: Math.max(0.01, Number(b.cbm ?? 0.25)),
          unitPrice: Math.max(0, Number(b.unitPrice ?? 0)),
          costPrice: Math.max(0, Number(b.costPrice ?? 0)),
          stock,
          minStock: Math.max(1, Math.floor(Number(b.minStock ?? 8))),
          isNew: Boolean(b.isNew),
          active: b.active !== false,
          imageUrl: String(b.imageUrl || '/images/bike-mtb.jpg').trim(),
          specs: String(b.specs || '').trim(),
        },
        include: { category: { select: { id: true, name: true, slug: true } } },
      });

      if (stock > 0) {
        await tx.inventoryLog.create({
          data: {
            productId: created.id,
            sku: created.sku,
            type: 'INBOUND',
            delta: stock,
            balanceAfter: stock,
            reference: 'OPENING-STOCK',
            note: `New SKU created by ${admin.name}`,
          },
        });
      }
      return created;
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error && err.message.includes('Unique') ? 'SKU already exists.' : 'Failed to create product.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  try {
    const b = await req.json();
    const id = String(b.id || '');
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });

    const nextStock = Math.max(0, Math.floor(Number(b.stock ?? existing.stock)));
    const delta = nextStock - existing.stock;

    const product = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: {
          sku: String(b.sku || existing.sku).trim().toUpperCase(),
          name: String(b.name || existing.name).trim(),
          categoryId: String(b.categoryId || existing.categoryId),
          color: String(b.color ?? existing.color).trim(),
          size: String(b.size ?? existing.size).trim(),
          unitsPerCarton: Math.max(1, Math.floor(Number(b.unitsPerCarton ?? existing.unitsPerCarton))),
          isBicycle: b.isBicycle !== undefined ? Boolean(b.isBicycle) : existing.isBicycle,
          cbm: Math.max(0.01, Number(b.cbm ?? existing.cbm)),
          unitPrice: Math.max(0, Number(b.unitPrice ?? existing.unitPrice)),
          costPrice: Math.max(0, Number(b.costPrice ?? existing.costPrice)),
          stock: nextStock,
          minStock: Math.max(1, Math.floor(Number(b.minStock ?? existing.minStock))),
          isNew: b.isNew !== undefined ? Boolean(b.isNew) : existing.isNew,
          active: b.active !== undefined ? Boolean(b.active) : existing.active,
          imageUrl: String(b.imageUrl || existing.imageUrl).trim(),
          specs: String(b.specs ?? existing.specs).trim(),
        },
        include: { category: { select: { id: true, name: true, slug: true } } },
      });

      if (delta !== 0) {
        await tx.inventoryLog.create({
          data: {
            productId: updated.id,
            sku: updated.sku,
            type: 'ADJUSTMENT',
            delta,
            balanceAfter: updated.stock,
            reference: 'ADMIN-EDIT',
            note: `Manual stock adjustment by ${admin.name}`,
          },
        });
      }
      return updated;
    });

    return NextResponse.json({ product });
  } catch {
    return NextResponse.json({ error: 'Failed to update product.' }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Product id required.' }, { status: 400 });

  // Soft-archive if linked to past orders so invoices stay intact
  const orderRefs = await prisma.orderItem.count({ where: { productId: id } });
  if (orderRefs > 0) {
    await prisma.product.update({ where: { id }, data: { active: false } });
    return NextResponse.json({ ok: true, archived: true });
  }

  await prisma.inventoryLog.deleteMany({ where: { productId: id } });
  await prisma.purchaseOrder.deleteMany({ where: { productId: id } });
  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
