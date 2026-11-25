import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser, requireAdmin } from '@/lib/auth';

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
  const body = await req.json();

  const updated = await prisma.order.update({
    where: { id },
    data: {
      ...(body.status ? { status: String(body.status) } : {}),
      ...(body.notes !== undefined ? { notes: String(body.notes) } : {}),
    },
    include: { items: true },
  });

  return NextResponse.json({ order: updated });
}
