import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { getSuggestedReorderQty } from '@/lib/rules';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  const purchaseOrders = await prisma.purchaseOrder.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ purchaseOrders });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  const b = await req.json();
  const product = await prisma.product.findUnique({ where: { id: String(b.productId || '') } });
  if (!product) {
    return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
  }

  const suggested = getSuggestedReorderQty(product.stock, product.minStock);
  const qty = Math.max(1, Math.floor(Number(b.qty || suggested)));
  const poNumber =
    String(b.poNumber || '').trim() ||
    `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 8999)}`;

  const po = await prisma.purchaseOrder.create({
    data: {
      poNumber,
      productId: product.id,
      sku: product.sku,
      productName: product.name,
      qty,
      unitCost: Math.max(0, Number(b.unitCost ?? product.costPrice)),
      supplier: String(b.supplier || 'Velo99 Factory Supply').trim(),
      status: 'pending',
    },
  });

  return NextResponse.json({ purchaseOrder: po }, { status: 201 });
}

export async function PUT(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  const b = await req.json();
  const id = String(b.id || '');
  const existing = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Purchase order not found.' }, { status: 404 });
  }

  // Received POs keep qty locked to preserve ledger integrity; pending POs can edit qty, cost & supplier
  const data: Record<string, unknown> = {
    supplier: String(b.supplier ?? existing.supplier).trim(),
    unitCost: Math.max(0, Number(b.unitCost ?? existing.unitCost)),
  };

  if (existing.status === 'pending') {
    data.qty = Math.max(1, Math.floor(Number(b.qty ?? existing.qty)));
    if (b.productId && String(b.productId) !== existing.productId) {
      const prod = await prisma.product.findUnique({ where: { id: String(b.productId) } });
      if (prod) {
        data.productId = prod.id;
        data.sku = prod.sku;
        data.productName = prod.name;
      }
    }
  }

  const purchaseOrder = await prisma.purchaseOrder.update({
    where: { id },
    data,
  });

  return NextResponse.json({ purchaseOrder });
}

export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  const b = await req.json();
  const id = String(b.id || '');
  const po = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!po) return NextResponse.json({ error: 'Purchase order not found.' }, { status: 404 });
  if (po.status === 'received') {
    return NextResponse.json({ error: 'Purchase order is already received.' }, { status: 400 });
  }

  // Atomic inbound stock addition + INBOUND inventory_logs entry (inventory-alert-rules)
  const updatedPo = await prisma.$transaction(async (tx) => {
    const prod = await tx.product.update({
      where: { id: po.productId },
      data: { stock: { increment: po.qty } },
    });

    await tx.inventoryLog.create({
      data: {
        productId: prod.id,
        sku: prod.sku,
        type: 'INBOUND',
        delta: po.qty,
        balanceAfter: prod.stock,
        reference: po.poNumber,
        note: `PO received from ${po.supplier} (by ${admin.name})`,
      },
    });

    return tx.purchaseOrder.update({
      where: { id: po.id },
      data: { status: 'received', receivedAt: new Date() },
    });
  });

  return NextResponse.json({ purchaseOrder: updatedPo });
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  const id = new URL(req.url).searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Purchase order id required.' }, { status: 400 });
  }

  await prisma.purchaseOrder.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
