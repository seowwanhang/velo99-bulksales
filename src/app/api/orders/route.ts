import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { calculateOrderFinancials } from '@/lib/rules';
import { sendOrderEmailNotification } from '@/lib/notify';

function stripProfitFields(order: Record<string, unknown>) {
  const { totalCost: _c, netProfit: _p, profitMargin: _m, ...rest } = order;
  void _c;
  void _p;
  void _m;
  const result: Record<string, unknown> = { ...rest };
  if (Array.isArray(result.items)) {
    result.items = (result.items as Record<string, unknown>[]).map((it) => {
      const { costPrice: _cp, ...itemRest } = it;
      void _cp;
      return itemRest;
    });
  }
  return result;
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  const { searchParams } = new URL(req.url);
  const orderNumber = searchParams.get('orderNumber')?.trim();

  if (orderNumber) {
    const found = await prisma.order.findUnique({
      where: { orderNumber },
      include: { items: true },
    });
    if (!found) {
      return NextResponse.json({ orders: [] });
    }
    const safe = user?.role === 'admin' ? found : stripProfitFields(found);
    return NextResponse.json({ orders: [safe] });
  }

  if (!user) {
    return NextResponse.json({ orders: [] });
  }

  const where = user.role === 'admin' ? {} : { userId: user.id };
  const orders = await prisma.order.findMany({
    where,
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });

  const safeOrders =
    user.role === 'admin' ? orders : orders.map((o) => stripProfitFields(o));

  return NextResponse.json({ orders: safeOrders });
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    const body = await req.json();

    const rawItems: Array<{ productId?: string; sku?: string; qty: number }> = Array.isArray(body.items)
      ? body.items
      : [];
    if (rawItems.length === 0) {
      return NextResponse.json({ error: 'Cart is empty.' }, { status: 400 });
    }

    const fulfillment = body.fulfillment === 'pickup' ? 'pickup' : 'delivery';
    const paymentMethod = [
      'bank_transfer',
      'credit_terms',
      'pay_at_hub',
      'fpx',
      'card',
      'instalment_3m',
    ].includes(body.paymentMethod)
      ? body.paymentMethod
      : 'bank_transfer';
    const customerName = String(body.customerName || user?.companyName || user?.name || '').trim();
    const customerPhone = String(body.customerPhone || user?.phone || '').trim();
    const customerEmail = String(body.customerEmail || user?.email || '').trim();
    const deliveryAddress = String(body.deliveryAddress || '').trim();
    const postcode = String(body.postcode || '').trim();
    const requestEInvoice = Boolean(body.requestEInvoice);
    const eInvoiceCompany = String(body.eInvoiceCompany || '').trim();
    const eInvoiceTin = String(body.eInvoiceTin || '').trim();

    if (!customerName || !customerPhone) {
      return NextResponse.json({ error: 'Contact name and phone number are required.' }, { status: 400 });
    }
    if (requestEInvoice && (!eInvoiceCompany || !eInvoiceTin)) {
      return NextResponse.json({ error: 'Company Name and TIN are required for LHDN e-Invoice.' }, { status: 400 });
    }

    const region = body.regionId
      ? await prisma.deliveryRegion.findUnique({ where: { id: String(body.regionId) } })
      : null;
    if (!region || !region.active) {
      return NextResponse.json({ error: 'Please select an active delivery region.' }, { status: 400 });
    }

    const settings = (await prisma.siteSettings.findUnique({ where: { id: 'main' } })) ?? {
      minOrderValue: 500,
      freeDeliveryCbm: 0.5,
      standardShippingFee: 80,
    };

    // Fetch latest products from DB
    const skus = rawItems.map((i) => i.sku).filter(Boolean) as string[];
    const ids = rawItems.map((i) => i.productId).filter(Boolean) as string[];
    const dbProducts = await prisma.product.findMany({
      where: {
        OR: [
          ...(skus.length ? [{ sku: { in: skus } }] : []),
          ...(ids.length ? [{ id: { in: ids } }] : []),
        ],
      },
    });

    const lines = rawItems.map((reqItem) => {
      const prod = dbProducts.find((p) => p.id === reqItem.productId || p.sku === reqItem.sku);
      const qty = Math.max(1, Math.floor(Number(reqItem.qty) || 0));
      return { prod, qty };
    });

    // Strict stock movement guard (inventory-alert-rules)
    for (const line of lines) {
      if (!line.prod || !line.prod.active) {
        return NextResponse.json({ error: 'One or more products are unavailable.' }, { status: 400 });
      }
      if (line.qty > line.prod.stock) {
        return NextResponse.json(
          {
            error: `Insufficient stock for ${line.prod.sku}: requested ${line.qty}, available ${line.prod.stock} carton(s).`,
          },
          { status: 400 }
        );
      }
    }

    const dealerTier = user?.tier || 'standard';
    const adminCustomDiscountRate =
      user?.role === 'admin' &&
      body.adminCustomDiscountPct !== undefined &&
      body.adminCustomDiscountPct !== '' &&
      body.adminCustomDiscountPct !== null
        ? Number(body.adminCustomDiscountPct) / 100
        : null;

    const fin = calculateOrderFinancials({
      items: lines.map((l) => ({
        unitPrice: l.prod!.unitPrice,
        costPrice: l.prod!.costPrice,
        qty: l.qty,
        unitsPerCarton: l.prod!.unitsPerCarton,
        isBicycle: l.prod!.isBicycle,
        cbm: l.prod!.cbm,
      })),
      tierId: dealerTier,
      fulfillment,
      settings: {
        minOrderValue: settings.minOrderValue,
        freeDeliveryCbm: settings.freeDeliveryCbm,
        standardShippingFee: settings.standardShippingFee,
      },
      adminCustomDiscountRate,
    });

    if (!fin.qualifiesMov) {
      return NextResponse.json(
        { error: `Minimum order value is RM ${settings.minOrderValue.toFixed(2)} after discount.` },
        { status: 400 }
      );
    }

    if (user && user.role !== 'admin' && user.creditUsed + fin.totalAmount > user.creditLimit) {
      return NextResponse.json(
        { error: `Order exceeds your RM ${user.creditLimit.toLocaleString('en-MY')} dealer credit limit.` },
        { status: 400 }
      );
    }

    const orderNumber = `V99-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 8999)}`;

    // Atomic database transaction: verify stock again, deduct stock, write OUTBOUND logs, create order
    const createdOrder = await prisma.$transaction(async (tx) => {
      for (const line of lines) {
        const fresh = await tx.product.findUnique({ where: { id: line.prod!.id } });
        if (!fresh || line.qty > fresh.stock) {
          throw new Error(`INSUFFICIENT_STOCK:${line.prod!.sku}`);
        }
        const updated = await tx.product.update({
          where: { id: fresh.id },
          data: { stock: { decrement: line.qty } },
        });
        await tx.inventoryLog.create({
          data: {
            productId: fresh.id,
            sku: fresh.sku,
            type: 'OUTBOUND',
            delta: -line.qty,
            balanceAfter: updated.stock,
            reference: orderNumber,
            note: `Order placed by ${customerName}`,
          },
        });
      }

      if (user && user.role !== 'admin') {
        await tx.user.update({
          where: { id: user.id },
          data: { creditUsed: { increment: fin.totalAmount } },
        });
      }

      return tx.order.create({
        data: {
          orderNumber,
          userId: user?.id ?? null,
          customerName,
          customerPhone,
          customerEmail,
          dealerTier,
          regionId: region.id,
          regionName: region.name,
          hubName: region.hubName,
          deliveryAddress,
          postcode: postcode || region.postcodePrefix,
          fulfillment,
          paymentMethod,
          requestEInvoice,
          eInvoiceCompany,
          eInvoiceTin,
          totalBikes: fin.totalBikes,
          totalCartons: fin.totalCartons,
          totalCbm: fin.totalCbm,
          discountRate: fin.discountRate,
          subtotal: fin.subtotal,
          discountAmount: fin.discountAmount,
          goodsRevenue: fin.goodsRevenue,
          shippingFee: fin.shippingFee,
          totalAmount: fin.totalAmount,
          totalCost: fin.totalCost,
          netProfit: fin.netProfit,
          profitMargin: fin.profitMargin,
          status: 'CONFIRMED',
          items: {
            create: lines.map((l) => ({
              productId: l.prod!.id,
              sku: l.prod!.sku,
              productName: l.prod!.name,
              qty: l.qty,
              unitsPerCarton: l.prod!.unitsPerCarton,
              cbm: l.prod!.cbm,
              unitPrice: l.prod!.unitPrice,
              costPrice: l.prod!.costPrice,
            })),
          },
        },
        include: { items: true },
      });
    });

    const fullSettings = await prisma.siteSettings.findUnique({ where: { id: 'main' } });
    void sendOrderEmailNotification({
      orderNumber: createdOrder.orderNumber,
      customerName: createdOrder.customerName,
      customerPhone: createdOrder.customerPhone,
      customerEmail: createdOrder.customerEmail,
      dealerTier: createdOrder.dealerTier,
      regionName: createdOrder.regionName,
      hubName: createdOrder.hubName,
      fulfillment: createdOrder.fulfillment,
      paymentMethod: createdOrder.paymentMethod,
      totalBikes: createdOrder.totalBikes,
      totalCartons: createdOrder.totalCartons,
      totalCbm: createdOrder.totalCbm,
      totalAmount: createdOrder.totalAmount,
      requestEInvoice: createdOrder.requestEInvoice,
      eInvoiceCompany: createdOrder.eInvoiceCompany,
      eInvoiceTin: createdOrder.eInvoiceTin,
      brandName: fullSettings?.brandName || 'Velo99 Bulksales',
      toEmail: fullSettings?.notifyEmail || '',
    });

    const responseOrder =
      user?.role === 'admin' ? createdOrder : stripProfitFields(createdOrder);

    return NextResponse.json({ order: responseOrder }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message.startsWith('INSUFFICIENT_STOCK:')) {
      return NextResponse.json(
        { error: `Insufficient stock for ${message.split(':')[1]}.` },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Order submission failed.' }, { status: 500 });
  }
}
