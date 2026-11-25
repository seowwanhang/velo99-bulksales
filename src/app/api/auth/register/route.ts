import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { setSessionCookie } from '@/lib/auth';
import { DEALER_TIERS } from '@/lib/rules';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const name = String(body.name || '').trim();
    const companyName = String(body.companyName || '').trim();
    const phone = String(body.phone || '').trim();

    if (!email || password.length < 6 || !name) {
      return NextResponse.json(
        { error: 'Name, valid email, and password (min 6 chars) are required.' },
        { status: 400 }
      );
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        phone,
        passwordHash,
        name,
        companyName: companyName || name,
        role: 'dealer',
        tier: 'standard',
        creditLimit: DEALER_TIERS.standard.defaultCreditLimit,
        creditUsed: 0,
      },
    });

    await setSessionCookie(user.id);

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          name: user.name,
          companyName: user.companyName,
          role: user.role,
          tier: user.tier,
          creditLimit: user.creditLimit,
          creditUsed: user.creditUsed,
        },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: 'Registration failed.' }, { status: 500 });
  }
}
