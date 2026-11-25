import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  const logs = await prisma.inventoryLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 150,
  });
  return NextResponse.json({ logs });
}
