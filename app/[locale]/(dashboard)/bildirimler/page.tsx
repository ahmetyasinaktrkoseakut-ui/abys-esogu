'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import BildirimlerTableClient from '@/components/BildirimlerTableClient';
import { useTranslations } from 'next-intl';
import { usePeriod } from '@/contexts/PeriodContext';
import { Loader2 } from 'lucide-react';

export default function BildirimlerPage() {
  const t = useTranslations('Notifications');
  const { selectedPeriod } = usePeriod();
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedPeriod) return;
      
      setIsLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('profiller')
          .select('rol')
          .eq('id', user.id)
          .single();

        const role = profile?.rol?.toLowerCase() || '';
        const isUserAdmin = role.includes('yonetici') || role.includes('yönetici') || role.includes('admin');
        setIsAdmin(isUserAdmin);

        if (isUserAdmin) {
          const { data } = await supabase
            .from('puko_degerlendirmeleri')
            .select('*, alt_olcutler(kod, olcut_adi, olcut_adi_en, olcut_adi_ar)')
            .eq('durum', 'Beklemede')
            .eq('donem_id', selectedPeriod.id)
            .order('olusturulma_tarihi', { ascending: false });
          
          setNotifications(data || []);
        } else {
          const { data: atamalar } = await supabase
            .from('kullanici_olcut_atamalari')
            .select('alt_olcut_id')
            .eq('user_id', user.id)
            .eq('donem_id', selectedPeriod.id);

          if (atamalar && atamalar.length > 0) {
            const allowedAltOlcutIds = atamalar.map(a => a.alt_olcut_id);
            const { data } = await supabase
              .from('puko_degerlendirmeleri')
              .select('*, alt_olcutler(kod, olcut_adi, olcut_adi_en, olcut_adi_ar)')
              .in('alt_olcut_id', allowedAltOlcutIds)
              .eq('donem_id', selectedPeriod.id)
              .order('olusturulma_tarihi', { ascending: false });

            setNotifications(data || []);
          } else {
            setNotifications([]);
          }
        }
      } catch (error) {
        console.error("Bildirimler yüklenemedi:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [selectedPeriod]);

  if (isLoading) {
    return <div className="h-[calc(100vh-100px)] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
      <div className="mb-6 flex flex-col gap-2">
        <h2 className="text-2xl font-bold text-slate-800">{t('title')}</h2>
        <p className="text-sm text-slate-500">
          {isAdmin ? t('description_admin') : t('description_user')}
        </p>
      </div>
      
      <BildirimlerTableClient initialData={notifications} />
    </div>
  );
}
