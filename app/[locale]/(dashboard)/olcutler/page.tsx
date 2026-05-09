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
  const [debugInfo, setDebugInfo] = useState<{ rawTitle: string; errorType: 'NONE' | 'MATCH' | 'FETCH' | 'ROLE' }>({ rawTitle: '', errorType: 'NONE' });
  const locale = useLocale();

  const toggleGroup = (groupKey: string) => {
    setOpenGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  useEffect(() => {
    async function fetchData() {
      if (!selectedPeriod) { setIsLoading(false); return; }
      try {
        setIsLoading(true);
        setDebugInfo({ rawTitle: '', errorType: 'NONE' });
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Profil ve Rol Çekme
        const { data: profile, error: profileError } = await supabase.from('profiller').select('rol').eq('id', user.id).single();
        const role = (profile?.rol || '').toLowerCase().trim();
        setUserRole(role);
        
        console.log('DEBUG_ROLE_CHECK:', { userId: user.id, role: role, fullProfile: profile });

        const isAdmin = role.includes('yonetici') || role.includes('admin');
        // Rol kontrolünü daha esnek yapıyoruz
        const isCoordinator = !isAdmin && (
          role.includes('koordinatör') || 
          role.includes('koordinator') || 
          role.includes('koord')
        );

        if (isAdmin) {
          const { data } = await supabase.from('alt_olcutler').select('*').order('id', { ascending: true });
          setOlcutler(data || []);
        } else if (isCoordinator) {
          const { data: coordData, error: coordError } = await supabase
            .from('baslik_koordinatorleri')
            .select('baslik')
            .eq('kullanici_id', user.id);
          
          console.log('DEBUG_COORD_DATA:', { data: coordData, error: coordError });

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
              const { data: allAlt } = await supabase.from('alt_olcutler').select('*').order('id', { ascending: true });
              if (allAlt) {
                const filtered = allAlt.filter(o => o.kod && o.kod.startsWith(assignedLetter));
                setOlcutler(filtered);
              }
            }
          }
        } else {
          // Eğer ne admin ne de koordinatörse ve profil geldiyse, bu bir birim kullanıcısıdır.
          // Ama sayfa boş geliyorsa buraya düşüyor olabilir.
          console.log('DEBUG: Fallback to Unit User');
          const { data } = await supabase
            .from('kullanici_olcut_atamalari')
            .select('alt_olcut_id, alt_olcutler(*)')
            .eq('user_id', user.id)
            .eq('donem_id', selectedPeriod.id);
            
          if (data) {
            setOlcutler(data.map(item => item.alt_olcutler).filter(Boolean));
          }
          if (!profile && !profileError) {
             setDebugInfo({ rawTitle: 'Profil Bulunamadı', errorType: 'ROLE' });
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
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-[40vh]"><Loader2 className="w-10 h-10 animate-spin text-indigo-600" /></div>
      ) : (
        <>
          {/* Hata Mesajları UI */}
          {debugInfo.errorType === 'ROLE' && (
            <div className="mb-8 p-10 bg-slate-800 text-white rounded-[2rem] shadow-2xl flex flex-col items-center gap-4 text-center">
              <ShieldAlert className="w-16 h-16 text-yellow-500" />
              <h3 className="text-2xl font-black uppercase">ROL HATASI: Kullanıcı rolü tespit edilemedi!</h3>
              <p className="opacity-70">Giriş yapan kullanıcının 'profiller' tablosunda bir rolü olduğundan emin olun.</p>
            </div>
          )}

          {debugInfo.errorType === 'FETCH' && (
            <div className="mb-8 p-10 bg-red-600 text-white rounded-[2rem] shadow-2xl flex flex-col items-center gap-4 text-center">
              <Database className="w-16 h-16 animate-pulse" />
              <h3 className="text-2xl font-black uppercase tracking-tighter">HATA: baslik_koordinatorleri TABLOSUNDA KAYDINIZ YOK!</h3>
              <p className="opacity-80">UID: {userRole} (Rolünüz bu olarak algılandı)</p>
            </div>
          )}

          {debugInfo.errorType === 'MATCH' && (
            <div className="mb-8 p-10 bg-orange-600 text-white rounded-[2rem] shadow-2xl flex flex-col items-center gap-4 text-center">
              <AlertCircle className="w-16 h-16 animate-bounce" />
              <h3 className="text-2xl font-black uppercase tracking-tighter">HATA: BAŞLIK EŞLEŞMEDİ! ({debugInfo.rawTitle})</h3>
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
              const baslikObj = anaBasliklar.find(b => b.kod === harf);
              const displayTitle = getLocalizedField(baslikObj, 'baslik_adi', locale) || t('group', { harf });
              const isOpen = openGroups[harf] || false;
              return (
                <div key={harf} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  <button onClick={() => toggleGroup(harf)} className="w-full px-6 py-5 flex items-center justify-between hover:bg-slate-50 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-bold">{harf}</div>
                      <h3 className="font-bold text-slate-800">{displayTitle}</h3>
                    </div>
                    <ChevronRight className={`w-5 h-5 text-slate-400 transition-all ${isOpen ? 'rotate-90' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="p-6 bg-slate-50 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border-t border-slate-100">
                      {items.map((olcut: any) => (
                        <Link key={olcut.id} href={`/olcutler/${olcut.id}/uygulama`} className="bg-white p-4 rounded-xl border border-slate-200 hover:border-indigo-400 transition-all shadow-sm">
                          <h4 className="font-bold text-sm text-slate-800">{olcut.kod} {getLocalizedField(olcut, 'olcut_adi', locale)}</h4>
                        </Link>
                      ))}
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
