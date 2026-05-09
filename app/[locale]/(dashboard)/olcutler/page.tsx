'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';
import { FileText, Loader2, ChevronRight, AlertCircle, Database } from 'lucide-react';
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
  const [debugInfo, setDebugInfo] = useState<{ rawTitle: string; errorType: 'NONE' | 'MATCH' | 'FETCH' }>({ rawTitle: '', errorType: 'NONE' });
  const locale = useLocale();

  const toggleGroup = (groupKey: string) => {
    setOpenGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };

  useEffect(() => {
    async function fetchData() {
      if (!selectedPeriod) {
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        setDebugInfo({ rawTitle: '', errorType: 'NONE' });
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase.from('profiller').select('rol').eq('id', user.id).single();
        const role = (profile?.rol || '').toLowerCase();
        setUserRole(role);
        
        const isAdmin = role.includes('yonetici') || role.includes('yönetici') || role.includes('admin');
        const isCoordinator = !isAdmin && (role.includes('koordinatör') || role.includes('koordinator'));

        if (isAdmin) {
          const { data } = await supabase.from('alt_olcutler').select('*').order('id', { ascending: true });
          setOlcutler(data || []);
        } else if (isCoordinator) {
          // 1. Ham Veriyi Konsola Bas (DEBUG)
          const { data: coordData, error: coordError } = await supabase
            .from('baslik_koordinatorleri')
            .select('baslik')
            .eq('kullanici_id', user.id);
          
          console.log('DEBUG_COORD:', { currentUser: user.id, data: coordData, error: coordError });

          if (!coordData || coordData.length === 0) {
            setDebugInfo({ rawTitle: '', errorType: 'FETCH' });
            setOlcutler([]);
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
              setOlcutler([]);
            } else {
              const { data: allAlt } = await supabase.from('alt_olcutler').select('*').order('id', { ascending: true });
              if (allAlt) {
                const filtered = allAlt.filter(o => o.kod && o.kod.startsWith(assignedLetter));
                setOlcutler(filtered);
              }
            }
          }
        } else {
          const { data } = await supabase
            .from('kullanici_olcut_atamalari')
            .select('alt_olcut_id, alt_olcutler(*)')
            .eq('user_id', user.id)
            .eq('donem_id', selectedPeriod.id);
            
          if (data) {
            const mappedOlcutler = data.map(item => item.alt_olcutler).filter(Boolean);
            setOlcutler(mappedOlcutler);
          } else {
            setOlcutler([]);
          }
        }
        
        const { data: baslikData } = await supabase.from('ana_basliklar').select('*');
        if (baslikData) setAnaBasliklar(baslikData);
      } catch (error) {
        console.error('OlcutlerPage Error:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [selectedPeriod]);

  return (
    <div className="p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="mb-8 border-b border-slate-200/60 pb-6">
        <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">{t('title') || 'Ölçütler'}</h2>
        <p className="text-slate-600 mt-2 font-bold text-sm leading-relaxed">{t('description') || 'Kurumsal akreditasyon için değerlendirilecek ölçütleri yönetin.'}</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-[40vh]">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
        </div>
      ) : (
        <>
          {/* 3. UI'da Görünür Hata Mesajları */}
          {debugInfo.errorType === 'FETCH' && (
            <div className="mb-8 p-10 bg-red-600 text-white rounded-[2.5rem] shadow-2xl flex flex-col items-center gap-4 text-center animate-in zoom-in-95">
              <Database className="w-16 h-16 animate-pulse" />
              <h3 className="text-3xl font-black uppercase tracking-tighter">HATA: Veritabanından koordinatör kaydı çekilemedi!</h3>
              <p className="font-bold opacity-80">Giriş yaptığınız kullanıcının 'baslik_koordinatorleri' tablosunda bir ataması olduğundan emin olun.</p>
            </div>
          )}

          {debugInfo.errorType === 'MATCH' && (
            <div className="mb-8 p-10 bg-orange-600 text-white rounded-[2.5rem] shadow-2xl flex flex-col items-center gap-4 text-center animate-in zoom-in-95">
              <AlertCircle className="w-16 h-16 animate-bounce" />
              <h3 className="text-3xl font-black uppercase tracking-tighter">HATA: Koordinatör başlığı ( {debugInfo.rawTitle} ) ile sistem eşleşemedi!</h3>
              <p className="font-bold opacity-80">Başlık metni 'Kalite', 'Eğitim', 'Öğretim', 'Araştırma', 'Toplumsal' veya 'Yönetim' kelimelerinden birini İÇERMELİDİR.</p>
            </div>
          )}

          <div className="space-y-4">
            {Object.entries(
              olcutler.reduce((acc, olcut) => {
                const groupKey = olcut.kod ? olcut.kod.split('.')[0] : 'Diğer';
                if (!acc[groupKey]) acc[groupKey] = [];
                acc[groupKey].push(olcut);
                return acc;
              }, {} as Record<string, any[]>)
            )
            .sort(([k1], [k2]) => k1.localeCompare(k2))
            .map(([harf, items]) => {
              const baslikObj = anaBasliklar.find(b => b.kod === harf || (b.baslik_adi && b.baslik_adi.startsWith(harf + '.')));
              const displayTitle = getLocalizedField(baslikObj, 'baslik_adi', locale) || t('group', { harf });
              const isOpen = openGroups[harf] || false;

              return (
                <div key={harf} className="animate-in fade-in duration-500 bg-white rounded-2xl border border-slate-200/60 overflow-hidden shadow-sm group">
                  <button onClick={() => toggleGroup(harf)} className="w-full px-6 py-5 flex items-center justify-between bg-white hover:bg-slate-50/50 transition-all text-left">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl flex items-center justify-center text-xl font-black transition-colors duration-300 group-hover:bg-indigo-600 group-hover:text-white">{harf}</div>
                      <div>
                        <h3 className="text-lg font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors">{displayTitle}</h3>
                        <p className="text-xs text-slate-500 font-semibold mt-0.5">{t('sub_criteria_count', { count: Array.isArray(items) ? items.length : 0 })}</p>
                      </div>
                    </div>
                    <ChevronRight className={`w-5 h-5 text-slate-300 transition-all duration-300 group-hover:text-indigo-600 ${isOpen ? 'rotate-90' : 'group-hover:translate-x-1.5'}`} />
                  </button>
                  {isOpen && (
                    <div className="p-8 border-t border-slate-100 bg-slate-50/30">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {(items as any[]).map((olcut: any) => (
                          <Link key={olcut.id} href={`/olcutler/${olcut.id}/uygulama`} className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm transition-all duration-300 hover:shadow-md hover:border-indigo-200 hover:bg-gradient-to-r hover:from-white hover:to-indigo-50/40 hover:-translate-y-0.5 group/card flex flex-col justify-between h-full relative overflow-hidden">
                            <div>
                              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 group-hover/card:bg-indigo-600 group-hover/card:text-white border border-indigo-100 transition-all duration-300"><FileText className="w-5 h-5" /></div>
                              <h4 className="font-extrabold text-slate-900 line-clamp-2 transition-colors group-hover/card:text-indigo-700">{[olcut.kod, getLocalizedField(olcut, 'olcut_adi', locale)].filter(Boolean).join(' ') || `Ölçüt #${olcut.id}`}</h4>
                            </div>
                            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-400 group-hover/card:text-indigo-600 transition-colors">
                              <span className="uppercase tracking-widest">{t('viewDetails') || 'Detayları Gör'}</span>
                              <ChevronRight className="w-4 h-4 text-slate-300 group-hover/card:text-indigo-600 group-hover/card:translate-x-1.5 transition-all" />
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
