import { SupabaseClient } from '@supabase/supabase-js';

export type LogType = 'INSERT' | 'UPDATE' | 'DELETE' | 'SEAL';

interface LogParams {
  supabase: SupabaseClient<any, any, any>;
  userId?: string;
  islemTipi: LogType;
  tabloAdi: string;
  kayitId?: string;
  eskiVeri?: any;
  yeniVeri?: any;
}

export async function logAction({
  supabase,
  userId,
  islemTipi,
  tabloAdi,
  kayitId,
  eskiVeri,
  yeniVeri
}: LogParams) {
  try {
    let finalUserId = userId;
    
    if (!finalUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      finalUserId = user?.id;
    }

    const { error } = await supabase.from('system_islem_loglari').insert({
      user_id: finalUserId,
      islem_tipi: islemTipi,
      tablo_adi: tabloAdi,
      kayit_id: kayitId,
      eski_veri: eskiVeri,
      yeni_veri: yeniVeri
    });

    if (error) console.error('Audit Log Error:', error);
  } catch (err) {
    console.error('Audit Log Fatal Error:', err);
  }
}
