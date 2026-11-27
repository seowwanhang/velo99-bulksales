import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { StorefrontClient } from '@/components/StorefrontClient';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
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

  const safeProducts = products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    categoryId: p.categoryId,
    category: p.category,
    color: p.color,
    size: p.size,
    unitsPerCarton: p.unitsPerCarton,
    isBicycle: p.isBicycle,
    cbm: p.cbm,
    unitPrice: p.unitPrice,
    ...(isAdmin ? { costPrice: p.costPrice } : {}),
    stock: p.stock,
    minStock: p.minStock,
    isNew: p.isNew,
    imageUrl: p.imageUrl,
    specs: p.specs,
  }));

  return (
    <StorefrontClient
      initialUser={user}
      settings={
        settings ?? {
          id: 'main',
          brandName: 'Velo99 Bulksales',
          tagline: 'Malaysia Online Bicycle Wholesale Platform',
          logoText: 'V99',
          supportPhone: '+6011-1600-0099',
          supportEmail: 'bulksales@velo99.my',
          supportHours: '09:00 AM - 05:00 PM',
          companyRegNo: 'Velo99 Wholesale Sdn Bhd',
          footerNotice: 'Serving Peninsular Malaysia.',
          minOrderValue: 500,
          freeDeliveryCbm: 0.5,
          standardShippingFee: 80,
          rescheduleFee: 30,
          cutoffHour: 13,
          instalmentPromoText: 'Manual Bank Transfer, DuitNow QR & Approved Dealer Credit Terms',
          bankName: 'Maybank Islamic',
          bankAccountName: 'Velo99 Wholesale Sdn Bhd',
          bankAccountNumber: '5123 4567 8901',
          duitNowQrUrl: '',
          whatsappOrderNumber: '601116000099',
          notifyEmail: 'bulksales@velo99.my',
          platinumDiscountPct: 15,
          goldDiscountPct: 10,
          silverDiscountPct: 5,
          standardDiscountPct: 0,
          volumeBonus10Pct: 2,
          volumeBonus20Pct: 3,
        }
      }
      banners={banners}
      regions={regions}
      categories={categories}
      initialProducts={safeProducts}
      faqs={faqs}
    />
  );
}
