import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  try {
    const settings = await prisma.siteSettings.findUnique({ where: { id: 'main' } });
    const brandName = settings?.brandName || 'CKH Bicycles Bulksales';
    const tagline = settings?.tagline || 'Malaysia Online Bicycle Wholesale Platform';
    return {
      title: tagline ? `${brandName} — ${tagline}` : brandName,
      description: `${brandName} — ${tagline}. Order bicycles and spare parts in wholesale cartons across Peninsular Malaysia with live CBM free delivery tracking and dealer tier discounts.`,
    };
  } catch {
    return {
      title: 'CKH Bicycles Bulksales — Malaysia Online Bicycle Wholesale Platform',
      description:
        'Order bicycles and spare parts in wholesale cartons across Peninsular Malaysia with live CBM free delivery tracking and dealer tier discounts.',
    };
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
