'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import BildirimlerTableClient from '@/components/BildirimlerTableClient';
import { useTranslations } from 'next-intl';
import { usePeriod } from '@/contexts/PeriodContext';
import { Loader2, AlertTriangle } from 'lucide-react';

export default function BildirimlerPage() {
  const t = useTranslations('Notifications');
  const { selectedPeriod } = usePeriod();
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedPeriod) return;
      
      setIsLoading(true);
      setErrorStatus(null);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('profiller')
          .select('rol')
          .eq('id', user.id)
          .single();

        const role = (profile?.rol || '').toLowerCase();
        const isUserAdmin = role.includes('yonetici') || role.includes('yönetici') || role.includes('admin');
        const isUserCoordinator = !isUserAdmin && (role.includes('koordinatör') || role.includes('koordinator'));
        
        // Zorunlu (force) true for coordinator/admin
        setIsAdmin(isUserAdmin || isUserCoordinator); 

        if (isUserAdmin) {
          const { data } = await supabase
            .from('puko_degerlendirmeleri')
            .select('*, alt_olcutler(kod, olcut_adi, olcut_adi_en, olcut_adi_ar)')
            .eq('durum', 'Beklemede')
            .eq('donem_id', selectedPeriod.id)
            .order('olusturulma_tarihi', { ascending: false });
          
          if (data) {
            const uniqueData = Array.from(new Map(data.map(item => [item.alt_olcut_id, item])).values());
            setNotifications(uniqueData);
          } else {
            setNotifications([]);
          }
        } else if (isUserCoordinator) {
          // 1. Manuel Yetki Haritası
          const authorityMap: Record<string, string> = { 
            'kalite': 'A', 
            'eğitim': 'B', 
            'öğretim': 'B', 
            'araştırma': 'C', 
            'toplumsal': 'D', 
            'yönetim': 'E' 
          };

          const { data: coordData } = await supabase
            .from('baslik_koordinatorleri')
            .select('baslik')
            .eq('kullanici_id', user.id)
            .single();

          let foundLetter = '';
          if (coordData?.baslik) {
            const b = coordData.baslik.toLowerCase();
            for (const key in authorityMap) {
              if (b.includes(key)) {
                foundLetter = authorityMap[key];
                break;
              }
            }
          }

          if (!foundLetter) {
            setErrorStatus('Hata: Yetkili Olduğunuz Başlık Tespit Edilemedi');
            setNotifications([]);
          } else {
            // 3. Bildirimler Zorunlu Filtreleme
            const { data: tumOlcutler } = await supabase.from('alt_olcutler').select('id, kod');
            const allowedAltOlcutIds = (tumOlcutler || [])
              .filter(o => o.kod && o.kod.startsWith(foundLetter))
              .map(o => o.id);

            if (allowedAltOlcutIds.length > 0) {
              const { data } = await supabase
                .from('puko_degerlendirmeleri')
                .select('*, alt_olcutler(kod, olcut_adi, olcut_adi_en, olcut_adi_ar)')
                .in('alt_olcut_id', allowedAltOlcutIds)
                .eq('durum', 'Beklemede')
                .eq('donem_id', selectedPeriod.id)
                .order('olusturulma_tarihi', { ascending: false });

              if (data) {
                const uniqueData = Array.from(new Map(data.map(item => [item.alt_olcut_id, item])).values());
                setNotifications(uniqueData);
              } else {
                setNotifications([]);
              }
            } else {
              setNotifications([]);
            }
          }
        } else {
          // Birim Kullanıcısı
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

            if (data) {
              const uniqueData = Array.from(new Map(data.map(item => [item.alt_olcut_id, item])).values());
              setNotifications(uniqueData);
            } else {
              setNotifications([]);
            }
          } else {
            setNotifications([]);
          }
        }
      } catch (error) {
        console.error("Bildirimler Page Error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [selectedPeriod]);

  if (isLoading) {
    return <div className="h-[calc(100vh-100px)] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-indigo-600" /></div>;
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
      <div className="mb-6 flex flex-col gap-2">
        <h2 className="text-2xl font-bold text-slate-800">{t('title')}</h2>
        <p className="text-sm text-slate-500">
          {isAdmin ? t('description_admin') : t('description_user')}
        </p>
      </div>

      {errorStatus && (
        <div className="mb-8 p-6 bg-red-50 border-2 border-red-200 rounded-3xl flex items-center gap-4 animate-bounce">
          <AlertTriangle className="w-8 h-8 text-red-600 animate-pulse" />
          <h3 className="text-xl font-black text-red-700 uppercase tracking-tighter">{errorStatus}</h3>
        </div>
      )}
      
      <BildirimlerTableClient initialData={notifications} isApprover={isAdmin} />
    </div>
  );
}
