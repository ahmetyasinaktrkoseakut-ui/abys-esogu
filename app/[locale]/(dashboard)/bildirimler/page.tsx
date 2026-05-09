'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import BildirimlerTableClient from '@/components/BildirimlerTableClient';
import { useTranslations } from 'next-intl';
import { usePeriod } from '@/contexts/PeriodContext';
import { Loader2, AlertCircle, Database, ShieldAlert } from 'lucide-react';

export default function BildirimlerPage() {
  const t = useTranslations('Notifications');
  const { selectedPeriod } = usePeriod();
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [debugInfo, setDebugInfo] = useState<{ rawTitle: string; errorType: 'NONE' | 'MATCH' | 'FETCH' | 'ROLE' }>({ rawTitle: '', errorType: 'NONE' });
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedPeriod) return;
      setIsLoading(true);
      setDebugInfo({ rawTitle: '', errorType: 'NONE' });
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase.from('profiller').select('rol').eq('id', user.id).single();
        const role = (profile?.rol || '').toLowerCase().trim();
        setUserRole(role);

        const isUserAdmin = role.includes('yonetici') || role.includes('admin');
        const isUserCoordinator = !isUserAdmin && (
          role.includes('koordinatör') || 
          role.includes('koordinator') || 
          role.includes('koord')
        );
        
        setIsAdmin(isUserAdmin || isUserCoordinator); 

        if (isUserAdmin) {
          const { data } = await supabase
            .from('puko_degerlendirmeleri')
            .select('*, alt_olcutler(kod, olcut_adi, olcut_adi_en, olcut_adi_ar)')
            .eq('durum', 'Beklemede')
            .eq('donem_id', selectedPeriod.id)
            .order('olusturulma_tarihi', { ascending: false });
          setNotifications(data ? Array.from(new Map(data.map(item => [item.alt_olcut_id, item])).values()) : []);
        } else if (isUserCoordinator) {
          const { data: coordData } = await supabase.from('baslik_koordinatorleri').select('baslik').eq('kullanici_id', user.id);
          
          if (!coordData || coordData.length === 0) {
            setDebugInfo({ rawTitle: '', errorType: 'FETCH' });
          } else {
            let assignedLetter = '';
            const rawTitle = (coordData[0]?.baslik || '').toLowerCase();
            if (rawTitle.includes('kalite')) assignedLetter = 'A';
            else if (rawTitle.includes('eğitim') || rawTitle.includes('öğretim')) assignedLetter = 'B';
            else if (rawTitle.includes('araştırma')) assignedLetter = 'C';
            else if (rawTitle.includes('toplumsal')) assignedLetter = 'D';
            else if (rawTitle.includes('yönetim')) assignedLetter = 'E';

            if (!assignedLetter) {
              setDebugInfo({ rawTitle: coordData[0]?.baslik, errorType: 'MATCH' });
            } else {
              const { data: tumOlcutler } = await supabase.from('alt_olcutler').select('id, kod');
              const allowedIds = (tumOlcutler || []).filter(o => o.kod && o.kod.startsWith(assignedLetter)).map(o => o.id);

              if (allowedIds.length > 0) {
                const { data } = await supabase
                  .from('puko_degerlendirmeleri')
                  .select('*, alt_olcutler(kod, olcut_adi, olcut_adi_en, olcut_adi_ar)')
                  .in('alt_olcut_id', allowedIds)
                  .eq('durum', 'Beklemede')
                  .eq('donem_id', selectedPeriod.id);
                setNotifications(data ? Array.from(new Map(data.map(item => [item.alt_olcut_id, item])).values()) : []);
              }
            }
          }
        } else {
           // Unit User logic...
           if (!profile) setDebugInfo({ rawTitle: '', errorType: 'ROLE' });
        }
      } catch (error) {
        console.error("Bildirimler Page Error:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [selectedPeriod]);

  if (isLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-indigo-600" /></div>;

  return (
    <div className="p-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">{t('title')}</h2>

      {debugInfo.errorType === 'ROLE' && (
        <div className="mb-8 p-10 bg-slate-800 text-white rounded-3xl flex flex-col items-center gap-4 text-center">
          <ShieldAlert className="w-16 h-16 text-yellow-500" />
          <h3 className="text-xl font-bold uppercase tracking-widest">ROL BULUNAMADI!</h3>
        </div>
      )}

      {debugInfo.errorType === 'FETCH' && (
        <div className="mb-8 p-10 bg-red-600 text-white rounded-3xl flex flex-col items-center gap-4 text-center">
          <Database className="w-16 h-16" />
          <h3 className="text-xl font-bold uppercase tracking-widest">KOORDİNATÖR KAYDI BULUNAMADI!</h3>
        </div>
      )}

      {debugInfo.errorType === 'MATCH' && (
        <div className="mb-8 p-10 bg-orange-600 text-white rounded-3xl flex flex-col items-center gap-4 text-center">
          <AlertCircle className="w-16 h-16" />
          <h3 className="text-xl font-bold uppercase tracking-widest">BAŞLIK EŞLEŞMEDİ! ({debugInfo.rawTitle})</h3>
        </div>
      )}
      
      <BildirimlerTableClient initialData={notifications} isApprover={isAdmin} />
    </div>
  );
}
