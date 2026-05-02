import { createClient } from '@/lib/supabase/server';
import IletisimClient from '@/components/IletisimClient';
import { redirect } from 'next/navigation';

export default async function IletisimPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return <IletisimClient currentUserId={user.id} />;
}
