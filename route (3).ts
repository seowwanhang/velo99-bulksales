import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  const faqs = await prisma.faqItem.findMany({ orderBy: { sortOrder: 'asc' } });
  return NextResponse.json({ faqs });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  const b = await req.json();
  const faq = await prisma.faqItem.create({
    data: {
      question: String(b.question || '').trim(),
      answer: String(b.answer || '').trim(),
      sortOrder: Number(b.sortOrder || 0),
      active: b.active !== false,
    },
  });
  return NextResponse.json({ faq }, { status: 201 });
}

export async function PUT(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  const b = await req.json();
  const faq = await prisma.faqItem.update({
    where: { id: String(b.id) },
    data: {
      question: String(b.question || '').trim(),
      answer: String(b.answer || '').trim(),
      sortOrder: Number(b.sortOrder || 0),
      active: Boolean(b.active),
    },
  });
  return NextResponse.json({ faq });
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'FAQ id required.' }, { status: 400 });
  await prisma.faqItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
