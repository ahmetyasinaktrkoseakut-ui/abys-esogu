'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import BildirimlerTableClient from '@/components/BildirimlerTableClient';
import { useTranslations } from 'next-intl';
import { usePeriod } from '@/contexts/PeriodContext';
import { Loader2, AlertCircle, Database } from 'lucide-react';

export default function BildirimlerPage() {
  const t = useTranslations('Notifications');
  const { selectedPeriod } = usePeriod();
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [debugInfo, setDebugInfo] = useState<{ rawTitle: string; errorType: 'NONE' | 'MATCH' | 'FETCH' }>({ rawTitle: '', errorType: 'NONE' });
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedPeriod) return;
      
      setIsLoading(true);
      setDebugInfo({ rawTitle: '', errorType: 'NONE' });
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
        
        // 4. Onay Butonlarını Force Et
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
          // 1. Ham Veriyi Konsola Bas (DEBUG)
          const { data: coordData, error: coordError } = await supabase
            .from('baslik_koordinatorleri')
            .select('baslik')
            .eq('kullanici_id', user.id);
          
          console.log('DEBUG_COORD_NOTIF:', { currentUser: user.id, data: coordData, error: coordError });

          if (!coordData || coordData.length === 0) {
            setDebugInfo({ rawTitle: '', errorType: 'FETCH' });
            setNotifications([]);
          } else {
            // 2. Veriyi Kod Seviyesinde Kilitle
            let assignedLetter = '';
            const rawTitle = (coordData[0]?.baslik || '').toLowerCase();
            
            if (rawTitle.includes('kalite')) assignedLetter = 'A';
            else if (rawTitle.includes('eğitim') || rawTitle.includes('öğretim')) assignedLetter = 'B';
            else if (rawTitle.includes('araştırma')) assignedLetter = 'C';
            else if (rawTitle.includes('toplumsal')) assignedLetter = 'D';
            else if (rawTitle.includes('yönetim')) assignedLetter = 'E';

            if (!assignedLetter) {
              setDebugInfo({ rawTitle: coordData[0]?.baslik || 'BOŞ', errorType: 'MATCH' });
              setNotifications([]);
            } else {
              const { data: tumOlcutler } = await supabase.from('alt_olcutler').select('id, kod');
              const allowedAltOlcutIds = (tumOlcutler || [])
                .filter(o => o.kod && o.kod.startsWith(assignedLetter))
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

      {/* 3. UI'da Görünür Hata Mesajları */}
      {debugInfo.errorType === 'FETCH' && (
        <div className="mb-8 p-10 bg-red-600 text-white rounded-[2.5rem] shadow-2xl flex flex-col items-center gap-4 text-center">
          <Database className="w-16 h-16 animate-pulse" />
          <h3 className="text-3xl font-black uppercase tracking-tighter">HATA: Veritabanından koordinatör kaydı çekilemedi!</h3>
          <p className="font-bold opacity-80">Giriş yaptığınız kullanıcının 'baslik_koordinatorleri' tablosunda bir ataması olduğundan emin olun.</p>
        </div>
      )}

      {debugInfo.errorType === 'MATCH' && (
        <div className="mb-8 p-10 bg-orange-600 text-white rounded-[2.5rem] shadow-2xl flex flex-col items-center gap-4 text-center">
          <AlertCircle className="w-16 h-16 animate-bounce" />
          <h3 className="text-3xl font-black uppercase tracking-tighter">HATA: Koordinatör başlığı ( {debugInfo.rawTitle} ) ile sistem eşleşemedi!</h3>
        </div>
      )}
      
      <BildirimlerTableClient initialData={notifications} isApprover={isAdmin} />
    </div>
  );
}
