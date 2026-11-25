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
  const settings = await prisma.siteSettings.upsert({
    where: { id: 'main' },
    update: {
      brandName: String(body.brandName ?? 'Velo99 Bulksales').trim(),
      tagline: String(body.tagline ?? '').trim(),
      logoText: String(body.logoText ?? 'V99').trim().slice(0, 5),
      supportPhone: String(body.supportPhone ?? '').trim(),
      supportEmail: String(body.supportEmail ?? '').trim(),
      supportHours: String(body.supportHours ?? '').trim(),
      companyRegNo: String(body.companyRegNo ?? '').trim(),
      footerNotice: String(body.footerNotice ?? '').trim(),
      minOrderValue: Math.max(0, Number(body.minOrderValue ?? 500)),
      freeDeliveryCbm: Math.max(0.05, Number(body.freeDeliveryCbm ?? 0.5)),
      standardShippingFee: Math.max(0, Number(body.standardShippingFee ?? 80)),
      rescheduleFee: Math.max(0, Number(body.rescheduleFee ?? 30)),
      cutoffHour: Math.max(0, Math.min(23, Math.floor(Number(body.cutoffHour ?? 13)))),
      instalmentPromoText: String(body.instalmentPromoText ?? '').trim(),
      bankName: String(body.bankName ?? '').trim(),
      bankAccountName: String(body.bankAccountName ?? '').trim(),
      bankAccountNumber: String(body.bankAccountNumber ?? '').trim(),
      duitNowQrUrl: String(body.duitNowQrUrl ?? '').trim(),
      whatsappOrderNumber: String(body.whatsappOrderNumber ?? '').replace(/[^0-9]/g, ''),
      notifyEmail: String(body.notifyEmail ?? '').trim(),
    },
    create: {
      id: 'main',
      brandName: String(body.brandName ?? 'Velo99 Bulksales').trim(),
    },
  });

  return NextResponse.json({ settings });
}
