import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export async function GET() {
  const user = await getSessionUser();
  const isAdmin = user?.role === 'admin';

  const [settings, banners, regions, categories, products, faqs] = await Promise.all([
    prisma.siteSettings.findUnique({ where: { id: 'main' } }),
    prisma.heroBanner.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.deliveryRegion.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.category.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { products: { where: { active: true } } } } },
    }),
    prisma.product.findMany({
      where: { active: true },
      orderBy: [{ isNew: 'desc' }, { createdAt: 'desc' }],
      include: { category: { select: { id: true, slug: true, name: true } } },
    }),
    prisma.faqItem.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
  ]);

  // Strict RBAC: Never expose costPrice to non-admin users (discount-calculation-rules)
  const safeProducts = products.map((p) => {
    if (isAdmin) return p;
    const { costPrice: _hidden, ...rest } = p;
    void _hidden;
    return rest;
  });

  return NextResponse.json({
    user,
    settings,
    banners,
    regions,
    categories,
    products: safeProducts,
    faqs,
  });
}
