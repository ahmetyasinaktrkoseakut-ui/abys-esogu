'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';
import { FileText, Loader2, ChevronRight, AlertCircle, Database, ShieldAlert } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { getLocalizedField } from '@/lib/i18n-utils';
import { usePeriod } from '@/contexts/PeriodContext';

export default function OlcutlerPage() {
  const t = useTranslations('Criteria');
  const { selectedPeriod } = usePeriod();
  const [olcutler, setOlcutler] = useState<any[]>([]);
  const [anaBasliklar, setAnaBasliklar] = useState<any[]>([]);
  const [userRole, setUserRole] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [errorStatus, setErrorStatus] = useState<{ msg: string; type: 'NONE' | 'FETCH' | 'MATCH' | 'ROLE' }>({ msg: '', type: 'NONE' });
  const locale = useLocale();

  const toggleGroup = (groupKey: string) => {
    setOpenGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  useEffect(() => {
    async function fetchData() {
      if (!selectedPeriod) { setIsLoading(false); return; }
      try {
        setIsLoading(true);
        setErrorStatus({ msg: '', type: 'NONE' });
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Profil ve Rol Kontrolü
        const { data: profile } = await supabase.from('profiller').select('rol').eq('id', user.id).single();
        const role = (profile?.rol || '').toLowerCase().trim();
        setUserRole(role);
        
        const isAdmin = role.includes('yonetici') || role.includes('admin');
        const isCoordinator = !isAdmin && (role.includes('koordinatör') || role.includes('koordinator') || role.includes('koord'));

        if (isAdmin) {
          const { data } = await supabase.from('alt_olcutler').select('*').order('id', { ascending: true });
          setOlcutler(data || []);
        } else if (isCoordinator) {
          // 2. Koordinatör Başlığı Sorgulama
          const { data: coordData, error: coordError } = await supabase
            .from('baslik_koordinatorleri')
            .select('baslik')
            .eq('kullanici_id', user.id);

          if (!coordData || coordData.length === 0) {
            setErrorStatus({ msg: 'Veritabanında koordinatör kaydı bulunamadı!', type: 'FETCH' });
          } else {
            const rawTitle = (coordData[0]?.baslik || '').toLowerCase();
            let assignedLetter = '';
            
            // Kesin Eşleşme Mantığı (Senin gönderdiğin "Kalite Güvencesi" dahil)
            if (rawTitle.includes('kalite')) assignedLetter = 'A';
            else if (rawTitle.includes('eğitim') || rawTitle.includes('öğretim')) assignedLetter = 'B';
            else if (rawTitle.includes('araştırma')) assignedLetter = 'C';
            else if (rawTitle.includes('toplumsal')) assignedLetter = 'D';
            else if (rawTitle.includes('yönetim')) assignedLetter = 'E';

            if (!assignedLetter) {
              setErrorStatus({ msg: `Başlık eşleşmedi: ${coordData[0].baslik}`, type: 'MATCH' });
            } else {
              const { data: allAlt } = await supabase.from('alt_olcutler').select('*').order('id', { ascending: true });
              if (allAlt) {
                const filtered = allAlt.filter(o => o.kod && o.kod.startsWith(assignedLetter));
                setOlcutler(filtered);
                // Grubu otomatik aç
                setOpenGroups({ [assignedLetter]: true });
              }
            }
          }
        } else {
          // Birim Kullanıcısı
          const { data } = await supabase
            .from('kullanici_olcut_atamalari')
            .select('alt_olcutler(*)')
            .eq('user_id', user.id)
            .eq('donem_id', selectedPeriod.id);
          if (data) setOlcutler(data.map(i => i.alt_olcutler).filter(Boolean));
          if (!profile) setErrorStatus({ msg: 'Rol tanımlı değil!', type: 'ROLE' });
        }
        
        const { data: baslikData } = await supabase.from('ana_basliklar').select('*');
        if (baslikData) setAnaBasliklar(baslikData);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [selectedPeriod]);

  if (isLoading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-indigo-600" /></div>;

  return (
    <div className="p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <h2 className="text-3xl font-black text-slate-900 mb-8 border-b pb-4">{t('title')}</h2>

      {errorStatus.type !== 'NONE' && (
        <div className="mb-8 p-8 bg-red-600 text-white rounded-3xl shadow-xl flex flex-col items-center text-center gap-3">
          <AlertCircle className="w-12 h-12" />
          <h3 className="text-xl font-bold uppercase">{errorStatus.msg}</h3>
          <p className="text-sm opacity-80">UID: {userRole}</p>
        </div>
      )}

      <div className="space-y-4">
        {Object.entries(
          olcutler.reduce((acc, o) => {
            const k = o.kod ? o.kod.split('.')[0] : 'Diğer';
            if (!acc[k]) acc[k] = [];
            acc[k].push(o);
            return acc;
          }, {} as Record<string, any[]>)
        ).sort().map(([harf, items]) => {
          const b = anaBasliklar.find(x => x.kod === harf);
          const title = getLocalizedField(b, 'baslik_adi', locale) || harf;
          return (
            <div key={harf} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <button onClick={() => toggleGroup(harf)} className="w-full p-6 flex justify-between items-center hover:bg-slate-50 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-indigo-600 text-white rounded-lg flex items-center justify-center font-bold">{harf}</div>
                  <span className="font-bold text-slate-800">{title}</span>
                </div>
                <ChevronRight className={`transition-all ${openGroups[harf] ? 'rotate-90' : ''}`} />
              </button>
              {openGroups[harf] && (
                <div className="p-6 bg-slate-50 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border-t">
                  {items.map((o: any) => (
                    <Link key={o.id} href={`/olcutler/${o.id}/uygulama`} className="p-4 bg-white border rounded-xl hover:border-indigo-500 shadow-sm transition-all">
                      <p className="text-sm font-bold text-slate-700">{o.kod} {getLocalizedField(o, 'olcut_adi', locale)}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
