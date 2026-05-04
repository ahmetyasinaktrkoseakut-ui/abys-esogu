import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DersIzlencesiClient from '@/components/DersIzlencesiClient';

export const dynamic = 'force-dynamic';

export default async function DersIzlenceleriPage({ searchParams }: { searchParams: Promise<{ kod?: string }> }) {
  const { kod } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  if (!kod) redirect('/izlenceler');

  const { data: dersler } = await supabase
    .from('dersler')
    .select('*')
    .order('yariyil')
    .order('kod');

  const { data: izlenceler } = await supabase
    .from('ders_izlenceleri')
    .select('id, ders_id, guncelleme_tarihi, icerik')
    .eq('hoca_id', user.id);

  // Profilden ad ve rol bilgisini al
  const { data: profile } = await supabase
    .from('profiller')
    .select('tam_adi, unvan, rol')
    .eq('id', user.id)
    .single();

  const { data: authUser } = await supabase.auth.getUser();
  const email = authUser.user?.email?.toLowerCase() || '';

  // Yetki Kontrolü: 
  // 1. Yönetici ise doğrudan izin ver
  // 2. Yönetici değilse kurumsal e-posta adresi kontrolü yap (@ogu.edu.tr veya @esogu.edu.tr olmalı ve ogrenci/std geçmemeli)
  const isYonetici = profile?.rol?.toLowerCase() === 'yonetici' || profile?.rol?.toLowerCase() === 'yönetici';
  const isKurumsalPersonel = (email.endsWith('@ogu.edu.tr') || email.endsWith('@esogu.edu.tr')) 
                              && !email.includes('ogrenci') 
                              && !email.includes('std');

  if (!isYonetici && !isKurumsalPersonel) {
    // Yetkisi yoksa genel izlenceler (sadece görüntüleme) sayfasına yönlendir
    redirect(`/izlenceler/${kod}`);
  }

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
