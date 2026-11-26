import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { DEALER_TIERS, DealerTierId } from '@/lib/rules';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      phone: true,
      name: true,
      companyName: true,
      role: true,
      tier: true,
      creditLimit: true,
      creditUsed: true,
      active: true,
      createdAt: true,
      _count: { select: { orders: true } },
    },
  });
  return NextResponse.json({ users });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  try {
    const b = await req.json();
    const email = String(b.email || '').trim().toLowerCase();
    const password = String(b.password || 'dealer123');
    const tier = (['platinum', 'gold', 'silver', 'standard'].includes(b.tier) ? b.tier : 'standard') as DealerTierId;
    const role = ['admin', 'sales', 'dealer'].includes(b.role) ? b.role : 'dealer';

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        phone: String(b.phone || '').trim(),
        passwordHash,
        name: String(b.name || '').trim(),
        companyName: String(b.companyName || '').trim(),
        role,
        tier,
        creditLimit: Number(b.creditLimit ?? DEALER_TIERS[tier].defaultCreditLimit),
        creditUsed: 0,
        active: b.active !== false,
      },
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        companyName: true,
        role: true,
        tier: true,
        creditLimit: true,
        creditUsed: true,
        active: true,
      },
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create account (email may already exist).' }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  try {
    const b = await req.json();
    const id = String(b.id || '');
    if (!id) return NextResponse.json({ error: 'Account ID is required.' }, { status: 400 });

    const role = ['admin', 'sales', 'dealer'].includes(b.role) ? b.role : 'dealer';
    const active = Boolean(b.active);

    if (id === admin.id && (role !== 'admin' || !active)) {
      return NextResponse.json(
        { error: 'You cannot demote or suspend your own currently logged-in Admin account.' },
        { status: 400 }
      );
    }

    const email = b.email !== undefined ? String(b.email).trim().toLowerCase() : undefined;
    if (email !== undefined && !email) {
      return NextResponse.json({ error: 'Email cannot be empty.' }, { status: 400 });
    }

    const data: Record<string, unknown> = {
      ...(email ? { email } : {}),
      name: String(b.name || '').trim(),
      companyName: String(b.companyName || '').trim(),
      phone: String(b.phone || '').trim(),
      role,
      tier: ['platinum', 'gold', 'silver', 'standard'].includes(b.tier) ? b.tier : 'standard',
      creditLimit: Math.max(0, Number(b.creditLimit ?? 12000)),
      creditUsed: Math.max(0, Number(b.creditUsed ?? 0)),
      active,
    };

    if (b.newPassword && String(b.newPassword).length >= 6) {
      data.passwordHash = await bcrypt.hash(String(b.newPassword), 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        companyName: true,
        role: true,
        tier: true,
        creditLimit: true,
        creditUsed: true,
        active: true,
      },
    });

    return NextResponse.json({ user });
  } catch {
    return NextResponse.json(
      { error: 'Failed to update account (email may already be in use).' },
      { status: 400 }
    );
  }
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Account ID is required.' }, { status: 400 });

  if (id === admin.id) {
    return NextResponse.json(
      { error: 'You cannot delete your own currently logged-in Admin account.' },
      { status: 400 }
    );
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  }

  if (target.role === 'admin') {
    const otherActiveAdmins = await prisma.user.count({
      where: { role: 'admin', active: true, id: { not: id } },
    });
    if (otherActiveAdmins === 0) {
      return NextResponse.json(
        { error: 'Cannot delete the last active Admin account.' },
        { status: 400 }
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    // Preserve historical order records while detaching the deleted user account
    await tx.order.updateMany({ where: { userId: id }, data: { userId: null } });
    await tx.user.delete({ where: { id } });
  });

  return NextResponse.json({ ok: true });
}
