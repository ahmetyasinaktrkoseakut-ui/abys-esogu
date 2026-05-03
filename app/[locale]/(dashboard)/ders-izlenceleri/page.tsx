import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DersIzlencesiClient from '@/components/DersIzlencesiClient';

export const dynamic = 'force-dynamic';

export default async function DersIzlenceleriPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: dersler } = await supabase
    .from('dersler')
    .select('*')
    .order('yariyil')
    .order('kod');

  const { data: izlenceler } = await supabase
    .from('ders_izlenceleri')
    .select('id, ders_id, guncelleme_tarihi')
    .eq('hoca_id', user.id);

  // Profilden ad bilgisi al
  const { data: profile } = await supabase
    .from('profiller')
    .select('tam_adi, unvan')
    .eq('id', user.id)
    .single();

  const { data: authUser } = await supabase.auth.getUser();
  const email = authUser.user?.email || '';

  return (
    <DersIzlencesiClient
      dersler={dersler || []}
      izlenceler={izlenceler || []}
      currentUserId={user.id}
      defaultOgretimElemani={profile?.tam_adi || ''}
      defaultEposta={email}
    />
  );
}
