import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AdminCmsClient } from '@/components/AdminCmsClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  try {
    const settings = await prisma.siteSettings.findUnique({ where: { id: 'main' } });
    const brandName = settings?.brandName || 'Admin CMS';
    return { title: `Admin CMS — ${brandName}` };
  } catch {
    return { title: 'Admin CMS' };
  }
}

export default async function AdminPage() {
  const user = await getSessionUser();
  return <AdminCmsClient initialUser={user} />;
}
