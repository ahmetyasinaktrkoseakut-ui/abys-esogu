'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Loader2, Calendar as CalendarIcon, Info, ChevronRight, Building, Users } from 'lucide-react';
import Link from 'next/link';

interface TakvimKaydi {
  id: string;
  puko_asamasi: string;
  baslangic_tarihi: string;
  bitis_tarihi: string;
  alt_olcut_id: string;
  alt_olcut_kodu: string;
  alt_olcut_adi: string;
  ana_baslik_kodu: string;
  ana_baslik_adi: string;
  birim_adi: string;
}

export default function TakvimClient() {
  const [kayitlar, setKayitlar] = useState<TakvimKaydi[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState('');
  const [userBirim, setUserBirim] = useState('');

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase.from('profiller').select('rol, birim_id').eq('id', user.id).single();
        const role = profile?.rol?.toLowerCase() || '';
        setUserRole(role);
        setUserBirim(profile?.birim_id || '');

        // Fetch all necessary data
        const { data: pukoData } = await supabase
          .from('puko_degerlendirmeleri')
          .select('id, puko_asamasi, baslangic_tarihi, bitis_tarihi, alt_olcut_id')
          .in('puko_asamasi', ['planlama', 'uygulama'])
          .not('baslangic_tarihi', 'is', null);

        const { data: altOlcutler } = await supabase.from('alt_olcutler').select('id, kod, olcut_adi, ana_baslik_id, sorumlu_birim_id');
        const { data: anaBasliklar } = await supabase.from('ana_basliklar').select('id, kod, baslik_adi');
        const { data: birimler } = await supabase.from('birimler').select('id, ad');

        if (!pukoData || !altOlcutler || !anaBasliklar) return;

        let formattedData: TakvimKaydi[] = pukoData.map(p => {
          const altOlcut = altOlcutler.find(a => a.id === p.alt_olcut_id);
          const anaBaslik = anaBasliklar.find(ab => ab.id === altOlcut?.ana_baslik_id);
          const birim = birimler?.find(b => b.id === altOlcut?.sorumlu_birim_id);

          return {
            id: p.id,
            puko_asamasi: p.puko_asamasi,
            baslangic_tarihi: p.baslangic_tarihi,
            bitis_tarihi: p.bitis_tarihi,
            alt_olcut_id: p.alt_olcut_id,
            alt_olcut_kodu: altOlcut?.kod || '',
            alt_olcut_adi: altOlcut?.olcut_adi || '',
            ana_baslik_kodu: anaBaslik?.kod || '',
            ana_baslik_adi: anaBaslik?.baslik_adi || '',
            birim_adi: birim?.ad || 'Bilinmeyen Birim',
            sorumlu_birim_id: altOlcut?.sorumlu_birim_id
          };
        });

        // Filter based on role
        const isAdmin = role.includes('yonetici') || role.includes('yönetici') || role.includes('admin');
        if (!isAdmin) {
          // Personnel sees only their unit's data
          formattedData = formattedData.filter((item: any) => item.sorumlu_birim_id === profile?.birim_id);
        }

        // Sort by start date
        formattedData.sort((a, b) => new Date(a.baslangic_tarihi).getTime() - new Date(b.baslangic_tarihi).getTime());

        setKayitlar(formattedData);
      } catch (error) {
        console.error("Takvim fetch error:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  const isAdmin = userRole.includes('yonetici') || userRole.includes('yönetici') || userRole.includes('admin');

  if (isLoading) {
    return <div className="h-[calc(100vh-100px)] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>;
  }

  // Format date correctly
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Belirsiz';
    const d = new Date(dateString);
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="p-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <CalendarIcon className="w-8 h-8 text-blue-600" />
          Takvim Modülü
        </h1>
        <p className="text-slate-500 mt-2 flex items-center gap-2">
          {isAdmin ? (
            <><Building className="w-4 h-4" /> Kurumsal düzeyde tüm planlama ve uygulama süreçlerinin takvimi.</>
          ) : (
            <><Users className="w-4 h-4" /> Biriminize atanan ölçütlerin planlama ve uygulama takvimi.</>
          )}
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {kayitlar.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="w-20 h-20 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mb-4">
              <CalendarIcon className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-slate-700 mb-2">Henüz Takvim Kaydı Yok</h3>
            <p className="text-slate-500 max-w-md">
              Planlama veya Uygulama sekmelerine başlangıç ve bitiş tarihleri girildiğinde bu alanda otomatik olarak listelenecektir.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                  <th className="p-4 pl-6">Tarih Aralığı</th>
                  <th className="p-4">Aşama</th>
                  <th className="p-4">Ana Başlık</th>
                  <th className="p-4">Alt Ölçüt</th>
                  {isAdmin && <th className="p-4">Sorumlu Birim</th>}
                  <th className="p-4 pr-6 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {kayitlar.map((kayit) => (
                  <tr key={kayit.id} className="hover:bg-blue-50/50 transition-colors group">
                    <td className="p-4 pl-6">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800 text-sm">
                          {formatDate(kayit.baslangic_tarihi)}
                        </span>
                        {kayit.bitis_tarihi && (
                          <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            Bitiş: {formatDate(kayit.bitis_tarihi)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                        kayit.puko_asamasi === 'planlama' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {kayit.puko_asamasi}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 max-w-[200px]">
                        <span className="text-xs font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{kayit.ana_baslik_kodu}</span>
                        <span className="text-sm text-slate-600 truncate" title={kayit.ana_baslik_adi}>{kayit.ana_baslik_adi}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 max-w-[300px]">
                        <span className="text-xs font-bold text-blue-400 bg-blue-50 px-1.5 py-0.5 rounded">{kayit.alt_olcut_kodu}</span>
                        <span className="text-sm font-semibold text-slate-700 truncate" title={kayit.alt_olcut_adi}>{kayit.alt_olcut_adi}</span>
                      </div>
                    </td>
                    {isAdmin && (
                      <td className="p-4">
                        <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-slate-400" />
                          {kayit.birim_adi}
                        </span>
                      </td>
                    )}
                    <td className="p-4 pr-6 text-right">
                      <Link 
                        href={`/olcutler/${kayit.alt_olcut_id}/${kayit.puko_asamasi}`}
                        className="inline-flex items-center justify-center p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Detaya Git"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
