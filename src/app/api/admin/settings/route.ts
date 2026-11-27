import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  const settings = await prisma.siteSettings.findUnique({ where: { id: 'main' } });
  return NextResponse.json({ settings });
}

export async function PUT(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  const body = await req.json();
  const clampPct = (val: unknown, fallback: number, max: number) => {
    const n = Number(val);
    if (!Number.isFinite(n)) return fallback;
    return Number(Math.max(0, Math.min(n, max)).toFixed(1));
  };

  const updateData: Record<string, unknown> = {};
  if (body.brandName !== undefined) updateData.brandName = String(body.brandName ?? 'Velo99 Bulksales').trim();
  if (body.tagline !== undefined) updateData.tagline = String(body.tagline ?? '').trim();
  if (body.logoText !== undefined) updateData.logoText = String(body.logoText ?? 'V99').trim().slice(0, 5);
  if (body.supportPhone !== undefined) updateData.supportPhone = String(body.supportPhone ?? '').trim();
  if (body.supportEmail !== undefined) updateData.supportEmail = String(body.supportEmail ?? '').trim();
  if (body.supportHours !== undefined) updateData.supportHours = String(body.supportHours ?? '').trim();
  if (body.companyRegNo !== undefined) updateData.companyRegNo = String(body.companyRegNo ?? '').trim();
  if (body.footerNotice !== undefined) updateData.footerNotice = String(body.footerNotice ?? '').trim();
  if (body.minOrderValue !== undefined) updateData.minOrderValue = Math.max(0, Number(body.minOrderValue ?? 500));
  if (body.freeDeliveryCbm !== undefined) updateData.freeDeliveryCbm = Math.max(0.05, Number(body.freeDeliveryCbm ?? 0.5));
  if (body.standardShippingFee !== undefined) updateData.standardShippingFee = Math.max(0, Number(body.standardShippingFee ?? 80));
  if (body.rescheduleFee !== undefined) updateData.rescheduleFee = Math.max(0, Number(body.rescheduleFee ?? 30));
  if (body.cutoffHour !== undefined) updateData.cutoffHour = Math.max(0, Math.min(23, Math.floor(Number(body.cutoffHour ?? 13))));
  if (body.instalmentPromoText !== undefined) updateData.instalmentPromoText = String(body.instalmentPromoText ?? '').trim();
  if (body.bankName !== undefined) updateData.bankName = String(body.bankName ?? '').trim();
  if (body.bankAccountName !== undefined) updateData.bankAccountName = String(body.bankAccountName ?? '').trim();
  if (body.bankAccountNumber !== undefined) updateData.bankAccountNumber = String(body.bankAccountNumber ?? '').trim();
  if (body.duitNowQrUrl !== undefined) updateData.duitNowQrUrl = String(body.duitNowQrUrl ?? '').trim();
  if (body.whatsappOrderNumber !== undefined) updateData.whatsappOrderNumber = String(body.whatsappOrderNumber ?? '').replace(/[^0-9]/g, '');
  if (body.notifyEmail !== undefined) updateData.notifyEmail = String(body.notifyEmail ?? '').trim();
  if (body.platinumDiscountPct !== undefined) updateData.platinumDiscountPct = clampPct(body.platinumDiscountPct, 15, 20);
  if (body.goldDiscountPct !== undefined) updateData.goldDiscountPct = clampPct(body.goldDiscountPct, 10, 20);
  if (body.silverDiscountPct !== undefined) updateData.silverDiscountPct = clampPct(body.silverDiscountPct, 5, 20);
  if (body.standardDiscountPct !== undefined) updateData.standardDiscountPct = clampPct(body.standardDiscountPct, 0, 20);
  if (body.volumeBonus10Pct !== undefined) updateData.volumeBonus10Pct = clampPct(body.volumeBonus10Pct, 2, 10);
  if (body.volumeBonus20Pct !== undefined) updateData.volumeBonus20Pct = clampPct(body.volumeBonus20Pct, 3, 10);

  const settings = await prisma.siteSettings.upsert({
    where: { id: 'main' },
    update: updateData,
    create: {
      id: 'main',
      brandName: String(body.brandName ?? 'Velo99 Bulksales').trim(),
      ...updateData,
    },
  });

  return NextResponse.json({ settings });
}
