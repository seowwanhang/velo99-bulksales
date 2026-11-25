import { getSessionUser } from '@/lib/auth';
import { AdminCmsClient } from '@/components/AdminCmsClient';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const user = await getSessionUser();
  return <AdminCmsClient initialUser={user} />;
}
