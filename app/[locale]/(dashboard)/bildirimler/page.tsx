import { createClient } from '@/lib/supabase/server';
import BildirimlerTableClient from '@/components/BildirimlerTableClient';
import { redirect } from 'next/navigation';

export default async function BildirimlerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Kullanıcı profili ve rolü kontrol et
  const { data: profile } = await supabase
    .from('profiller')
    .select('rol')
    .eq('id', user.id)
    .single();

  const role = profile?.rol?.toLowerCase() || '';
  const isAdmin = role.includes('yonetici') || role.includes('yönetici') || role.includes('admin');

  let notifications: any[] = [];

  if (isAdmin) {
    // Admin: Durumu 'Beklemede' olanları getir
    const { data } = await supabase
      .from('puko_degerlendirmeleri')
      .select('*, alt_olcutler(kod, olcut_adi)')
      .eq('durum', 'Beklemede')
      .order('olusturulma_tarihi', { ascending: false });
      
    if (data) notifications = data;
    
  } else {
    // Personel: Kullanıcıya atanmış ölçütlerdeki 'Reddedildi' olanları getir
    const { data: atamalar } = await supabase
      .from('kullanici_olcut_atamalari')
      .select('alt_olcut_id')
      .eq('user_id', user.id);

    if (atamalar && atamalar.length > 0) {
      const allowedAltOlcutIds = atamalar.map(a => a.alt_olcut_id);
      const { data } = await supabase
        .from('puko_degerlendirmeleri')
        .select('*, alt_olcutler(kod, olcut_adi)')
        .in('alt_olcut_id', allowedAltOlcutIds)
        .order('olusturulma_tarihi', { ascending: false });

      if (data) notifications = data;
    }
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
      <div className="mb-6 flex flex-col gap-2">
        <h2 className="text-2xl font-bold text-slate-800">Bildirim Merkezi</h2>
        <p className="text-sm text-slate-500">
          {isAdmin 
            ? 'Onayınızı bekleyen personel PUKÖ kanıt girişleri aşağıda listelenmektedir.'
            : 'Gönderdiğiniz PUKÖ veri girişlerinizin güncel durumları (Beklemede, Onaylandı, Reddedildi).'}
        </p>
      </div>
      
      <BildirimlerTableClient initialData={notifications} />
    </div>
  );
}
