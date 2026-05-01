'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';
import { FileText, Loader2, ChevronRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { getLocalizedField } from '@/lib/i18n-utils';
import { usePeriod } from '@/contexts/PeriodContext';

export default function OlcutlerPage() {
  const t = useTranslations('Criteria');
  const { selectedPeriod } = usePeriod();
  const [olcutler, setOlcutler] = useState<any[]>([]);
  const [anaBasliklar, setAnaBasliklar] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
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
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase.from('profiller').select('rol').eq('id', user.id).single();
        const role = profile?.rol?.toLowerCase() || '';
        const isAdmin = role.includes('yonetici') || role.includes('yönetici') || role.includes('admin');

        if (isAdmin) {
          const { data } = await supabase.from('alt_olcutler').select('*').order('id', { ascending: true });
          setOlcutler(data || []);
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
        
        // Fetch ana basliklar for grouping
        const { data: baslikData } = await supabase.from('ana_basliklar').select('*');
        if (baslikData) {
          setAnaBasliklar(baslikData);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [selectedPeriod]);

  return (
    <div className="p-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-6 border-b border-slate-200 pb-4">
        <h2 className="text-2xl font-bold text-[#0f172a] tracking-tight">{t('title') || 'Ölçütler'}</h2>
        <p className="text-slate-500 mt-1 text-sm">{t('description') || 'Kurumsal akreditasyon için değerlendirilecek ölçütleri yönetin.'}</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
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
              <div key={harf} className="animate-in fade-in duration-500 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <button 
                  onClick={() => toggleGroup(harf)}
                  className="w-full px-6 py-5 flex items-center justify-between bg-slate-50/50 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center text-lg font-bold">
                      {harf}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">{displayTitle}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{t('sub_criteria_count', { count: Array.isArray(items) ? items.length : 0 })}</p>
                    </div>
                  </div>
                  <ChevronRight className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`} />
                </button>
                
                {isOpen && (
                  <div className="p-6 border-t border-slate-100 bg-[#F8FAFC]">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {(items as any[]).map((olcut: any) => (
                        <Link 
                          key={olcut.id} 
                          href={`/olcutler/${olcut.id}/uygulama`}
                          className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-400 transition-all group flex flex-col justify-between h-full"
                        >
                          <div>
                            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                              <FileText className="w-5 h-5" />
                            </div>
                            <h4 className="font-semibold text-slate-800 line-clamp-2">
                              {[olcut.kod, getLocalizedField(olcut, 'olcut_adi', locale)].filter(Boolean).join(' ') || `Ölçüt #${olcut.id}`}
                            </h4>
                            {olcut.aciklama && (
                              <p className="text-sm text-slate-500 mt-2 line-clamp-3 leading-relaxed">
                                {olcut.aciklama}
                              </p>
                            )}
                          </div>
                          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-sm font-medium text-indigo-600">
                            <span>{t('viewDetails') || 'Detayları Gör'}</span>
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
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
      )}
    </div>
  );
}
