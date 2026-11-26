import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser, requireAdmin } from '@/lib/auth';
import { MAX_ADMIN_DISCOUNT } from '@/lib/rules';

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const user = await getSessionUser();
  const order = await prisma.order.findFirst({
    where: { OR: [{ id }, { orderNumber: id }] },
    include: { items: true },
  });
  if (!order) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }
  if (user?.role === 'admin') {
    return NextResponse.json({ order });
  }
  const { totalCost: _c, netProfit: _p, profitMargin: _m, ...safe } = order;
  void _c;
  void _p;
  void _m;
  return NextResponse.json({
    order: {
      ...safe,
      items: order.items.map(({ costPrice: _cp, ...rest }) => {
        void _cp;
        return rest;
      }),
    },
  });
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await prisma.order.findUnique({ where: { id }, include: { items: true } });
  if (!existing) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }

  const body = await req.json();

  // Compute financials with Admin discount cap (25% max) per discount-calculation-rules
  const nextDiscountRate =
    body.discountRate !== undefined
      ? Math.max(0, Math.min(Number(body.discountRate), MAX_ADMIN_DISCOUNT))
      : existing.discountRate;
  const nextShippingFee =
    body.shippingFee !== undefined ? Math.max(0, Number(body.shippingFee)) : existing.shippingFee;
  const nextTotalCost =
    body.totalCost !== undefined ? Math.max(0, Number(body.totalCost)) : existing.totalCost;

  const discountAmount = Number((existing.subtotal * nextDiscountRate).toFixed(2));
  const goodsRevenue = Number((existing.subtotal - discountAmount).toFixed(2));
  const totalAmount = Number((goodsRevenue + nextShippingFee).toFixed(2));
  const netProfit = Number((goodsRevenue - nextTotalCost - nextShippingFee).toFixed(2));
  const profitMargin =
    goodsRevenue > 0 ? Number(((netProfit / goodsRevenue) * 100).toFixed(1)) : 0;

  const amountDelta = Number((totalAmount - existing.totalAmount).toFixed(2));

  const updated = await prisma.$transaction(async (tx) => {
    if (existing.userId && amountDelta !== 0) {
      const buyer = await tx.user.findUnique({ where: { id: existing.userId } });
      if (buyer && buyer.role !== 'admin') {
        await tx.user.update({
          where: { id: buyer.id },
          data: { creditUsed: Math.max(0, Number((buyer.creditUsed + amountDelta).toFixed(2))) },
        });
      }
    }

    return tx.order.update({
      where: { id },
      data: {
        ...(body.status !== undefined ? { status: String(body.status) } : {}),
        ...(body.notes !== undefined ? { notes: String(body.notes) } : {}),
        ...(body.customerName !== undefined ? { customerName: String(body.customerName).trim() } : {}),
        ...(body.customerPhone !== undefined ? { customerPhone: String(body.customerPhone).trim() } : {}),
        ...(body.customerEmail !== undefined ? { customerEmail: String(body.customerEmail).trim() } : {}),
        ...(body.deliveryAddress !== undefined ? { deliveryAddress: String(body.deliveryAddress).trim() } : {}),
        ...(body.postcode !== undefined ? { postcode: String(body.postcode).trim() } : {}),
        ...(body.fulfillment !== undefined
          ? { fulfillment: body.fulfillment === 'pickup' ? 'pickup' : 'delivery' }
          : {}),
        ...(body.paymentMethod !== undefined ? { paymentMethod: String(body.paymentMethod) } : {}),
        ...(body.requestEInvoice !== undefined ? { requestEInvoice: Boolean(body.requestEInvoice) } : {}),
        ...(body.eInvoiceCompany !== undefined ? { eInvoiceCompany: String(body.eInvoiceCompany).trim() } : {}),
        ...(body.eInvoiceTin !== undefined ? { eInvoiceTin: String(body.eInvoiceTin).trim() } : {}),
        discountRate: nextDiscountRate,
        discountAmount,
        goodsRevenue,
        shippingFee: nextShippingFee,
        totalAmount,
        totalCost: nextTotalCost,
        netProfit,
        profitMargin,
      },
      include: { items: true },
    });
  });

  return NextResponse.json({ order: updated });
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const { id } = await context.params;
  const restoreStock = new URL(req.url).searchParams.get('restoreStock') === 'true';

  const existing = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    if (restoreStock) {
      for (const item of existing.items) {
        const prod = await tx.product.findUnique({ where: { id: item.productId } });
        if (prod) {
          const updatedProd = await tx.product.update({
            where: { id: prod.id },
            data: { stock: { increment: item.qty } },
          });
          await tx.inventoryLog.create({
            data: {
              productId: prod.id,
              sku: prod.sku,
              type: 'INBOUND',
              delta: item.qty,
              balanceAfter: updatedProd.stock,
              reference: existing.orderNumber,
              note: `Order deleted & stock restored by ${admin.name}`,
            },
          });
        }
      }
    }

    if (existing.userId) {
      const buyer = await tx.user.findUnique({ where: { id: existing.userId } });
      if (buyer && buyer.role !== 'admin') {
        await tx.user.update({
          where: { id: buyer.id },
          data: {
            creditUsed: Math.max(0, Number((buyer.creditUsed - existing.totalAmount).toFixed(2))),
          },
        });
      }
    }

    await tx.order.delete({ where: { id: existing.id } });
  });

  return NextResponse.json({ ok: true, restoredStock: restoreStock });
}
