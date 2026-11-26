import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  const logs = await prisma.inventoryLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return NextResponse.json({ logs });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  try {
    const b = await req.json();
    const productId = String(b.productId || '');
    const rawDelta = Math.floor(Number(b.delta || 0));
    const type = ['INBOUND', 'OUTBOUND', 'ADJUSTMENT'].includes(b.type)
      ? String(b.type)
      : 'ADJUSTMENT';
    const reference = String(b.reference || 'MANUAL-ADJ').trim();
    const note = String(b.note || `Manual adjustment by ${admin.name}`).trim();

    if (!productId || rawDelta === 0) {
      return NextResponse.json(
        { error: 'Please select a product and enter a non-zero quantity change.' },
        { status: 400 }
      );
    }

    const signedDelta =
      type === 'OUTBOUND' ? -Math.abs(rawDelta) : type === 'INBOUND' ? Math.abs(rawDelta) : rawDelta;

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product) throw new Error('NOT_FOUND');

      const nextStock = product.stock + signedDelta;
      if (nextStock < 0) {
        throw new Error(`NEGATIVE_STOCK:${product.stock}`);
      }

      const updated = await tx.product.update({
        where: { id: product.id },
        data: { stock: nextStock },
      });

      const log = await tx.inventoryLog.create({
        data: {
          productId: product.id,
          sku: product.sku,
          type,
          delta: signedDelta,
          balanceAfter: updated.stock,
          reference,
          note,
        },
      });

      return { log, balanceAfter: updated.stock };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    }
    if (msg.startsWith('NEGATIVE_STOCK:')) {
      return NextResponse.json(
        { error: `Cannot reduce stock below 0 (current stock: ${msg.split(':')[1]} cartons).` },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Stock adjustment failed.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const clearAll = searchParams.get('clearAll') === 'true';
  const id = searchParams.get('id');

  if (clearAll) {
    await prisma.inventoryLog.deleteMany({});
    return NextResponse.json({ ok: true, cleared: true });
  }

  if (!id) {
    return NextResponse.json({ error: 'Log id or clearAll=true required.' }, { status: 400 });
  }

  await prisma.inventoryLog.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
