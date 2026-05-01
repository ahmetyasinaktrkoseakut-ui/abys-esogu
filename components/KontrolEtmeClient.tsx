'use client';

import { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Loader2, Save, Settings, Plus, Trash2, Link as LinkIcon, Edit3, BarChart2, ChevronDown, ChevronUp } from 'lucide-react';
import StepPanel from '@/components/StepPanel';
import RichTextEditor from '@/components/RichTextEditor';
import { useLocale } from 'next-intl';
import { getLocalizedField } from '@/lib/i18n-utils';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Cell } from 'recharts';

interface KontrolEtmeClientProps {
  params: Promise<{ id: string }>;
}

type SoruTipi = 'kisa_yanit' | 'coktan_secmeli' | 'puanlama';

interface Secenek {
  id: string;
  metin: string;
}

interface Soru {
  id: string;
  tip: SoruTipi;
  soru: string;
  secenekler?: Secenek[]; // Sadece coktan_secmeli için
}

interface Anket {
  id?: string;
  baslik: string;
  sorular: Soru[];
  aciklama: string; // Bağımsız değerlendirme raporu
  isExpanded?: boolean;
}

interface AnketCevapOzeti {
  soru_id: string;
  cevaplar: any[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#FF6666'];

export default function KontrolEtmeClient({ params }: KontrolEtmeClientProps) {
  const resolvedParams = use(params);
  const [olcutDetay, setOlcutDetay] = useState<any>(null);
  
  // Çoklu Anket State
  const [anketListesi, setAnketListesi] = useState<Anket[]>([]);
  
  // Genel PUKÖ State
  const [pukoId, setPukoId] = useState<string | null>(null);
  
  // Cevap Data: anketId -> soruId -> cevaplar array
  const [cevapOzetleri, setCevapOzetleri] = useState<Record<string, AnketCevapOzeti[]>>({});
  const [toplamCevaplar, setToplamCevaplar] = useState<Record<string, number>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const locale = useLocale();

  const fetchData = async () => {
    try {
      setIsLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiller').select('rol').eq('id', user.id).single();
        const role = profile?.rol?.toLowerCase() || '';
        if (role.includes('yonetici') || role.includes('yönetici') || role.includes('admin')) {
          setIsReadOnly(true);
        }
      }
      
      const { data: olcut } = await supabase.from('alt_olcutler').select('*').eq('id', resolvedParams.id).single();
      if (olcut) setOlcutDetay(olcut);

      // Fetch PUKO
      const { data: pukoData } = await supabase
        .from('puko_degerlendirmeleri')
        .select('*')
        .eq('alt_olcut_id', resolvedParams.id)
        .eq('puko_asamasi', 'kontrol')
        .order('id', { ascending: false })
        .limit(1)
        .single();

      if (pukoData) {
        setPukoId(pukoData.id.toString());
      }

      // Fetch Tüm Anketler
      const { data: anketData } = await supabase
        .from('anketler')
        .select('*')
        .eq('alt_olcut_id', resolvedParams.id)
        .order('id', { ascending: true });

      if (anketData && anketData.length > 0) {
        const mappedAnketler: Anket[] = anketData.map((a: any, idx: number) => ({
          id: a.id.toString(),
          baslik: a.baslik || 'Yeni Anket',
          sorular: a.sorular || [],
          aciklama: a.aciklama || '',
          isExpanded: idx === 0 // İlk anket açık gelsin
        }));
        
        setAnketListesi(mappedAnketler);
        
        // Fetch Cevaplar
        const anketIds = anketData.map(a => a.id);
        const { data: cevaplarData } = await supabase
          .from('anket_cevaplari')
          .select('anket_id, cevaplar')
          .in('anket_id', anketIds);

        if (cevaplarData) {
          const tCevap: Record<string, number> = {};
          const cOzet: Record<string, AnketCevapOzeti[]> = {};
          
          anketIds.forEach(id => {
            const anketinCevaplari = cevaplarData.filter(c => c.anket_id === id);
            tCevap[id.toString()] = anketinCevaplari.length;
            
            const ozet: Record<string, any[]> = {};
            anketinCevaplari.forEach(c => {
              const yanitlar = c.cevaplar as Record<string, any>;
              if (yanitlar) {
                Object.keys(yanitlar).forEach(sId => {
                  if (!ozet[sId]) ozet[sId] = [];
                  ozet[sId].push(yanitlar[sId]);
                });
              }
            });
            cOzet[id.toString()] = Object.keys(ozet).map(k => ({ soru_id: k, cevaplar: ozet[k] }));
          });

          setToplamCevaplar(tCevap);
          setCevapOzetleri(cOzet);
        }
      } else {
        // Hiç anket yoksa 1 tane boş ekle
        setAnketListesi([{
          id: undefined,
          baslik: 'Değerlendirme Anketi 1',
          sorular: [],
          aciklama: '',
          isExpanded: true
        }]);
      }
    } catch (error) {
      console.error("Fetch Data Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [resolvedParams.id]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 1. Genel PUKÖ Kaydı
      const upsertPuko: Record<string, any> = {
        alt_olcut_id: resolvedParams.id,
        puko_asamasi: 'kontrol',
        durum: 'Beklemede',
        red_nedeni: null
      };
      
      if (pukoId) {
        await supabase.from('puko_degerlendirmeleri').update(upsertPuko).eq('id', pukoId);
      } else {
        const { data: newPuko } = await supabase.from('puko_degerlendirmeleri').insert(upsertPuko).select('id').single();
        if (newPuko) setPukoId(newPuko.id.toString());
      }

      // 2. Anketleri Kaydet
      for (const anket of anketListesi) {
        const upsertAnket: Record<string, any> = {
          alt_olcut_id: resolvedParams.id,
          baslik: anket.baslik,
          sorular: anket.sorular,
          aciklama: anket.aciklama
        };

        if (anket.id && !anket.id.startsWith('temp_')) {
          await supabase.from('anketler').update(upsertAnket).eq('id', anket.id);
        } else {
          await supabase.from('anketler').insert(upsertAnket);
        }
      }

      alert('Değişiklikler başarıyla kaydedildi!');
      fetchData(); 
    } catch (error: any) {
      console.error('Save Error:', error);
      alert(`Kaydetme Hatası: ${error.message || 'Bilinmeyen Hata'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const addNewAnket = () => {
    const tempId = 'temp_' + Math.random().toString(36).substr(2, 9);
    setAnketListesi(prev => [
      ...prev.map(a => ({...a, isExpanded: false})), // Diğerlerini kapat
      {
        id: tempId,
        baslik: `Yeni Anket ${prev.length + 1}`,
        sorular: [],
        aciklama: '',
        isExpanded: true
      }
    ]);
  };

  const toggleAnket = (idx: number) => {
    setAnketListesi(prev => prev.map((a, i) => i === idx ? { ...a, isExpanded: !a.isExpanded } : a));
  };

  const updateAnketField = (idx: number, field: keyof Anket, value: any) => {
    setAnketListesi(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));
  };

  const deleteAnket = async (idx: number) => {
    const anket = anketListesi[idx];
    if (confirm(`"${anket.baslik}" anketini silmek istediğinize emin misiniz?`)) {
      if (anket.id && !anket.id.startsWith('temp_')) {
        try {
          await supabase.from('anketler').delete().eq('id', anket.id);
        } catch (err) {
          console.error("Silme hatası:", err);
        }
      }
      setAnketListesi(prev => prev.filter((_, i) => i !== idx));
    }
  };

  const handleAddSoru = (anketIdx: number, tip: SoruTipi) => {
    const anket = anketListesi[anketIdx];
    const newSoru: Soru = {
      id: Math.random().toString(36).substr(2, 9),
      tip,
      soru: '',
      ...(tip === 'coktan_secmeli' ? { secenekler: [{ id: Math.random().toString(36).substr(2, 9), metin: 'Seçenek 1' }] } : {})
    };
    updateAnketField(anketIdx, 'sorular', [...anket.sorular, newSoru]);
  };

  const handleRemoveSoru = (anketIdx: number, soruId: string) => {
    if (confirm("Bu soruyu silmek istediğinize emin misiniz?")) {
      const anket = anketListesi[anketIdx];
      updateAnketField(anketIdx, 'sorular', anket.sorular.filter(s => s.id !== soruId));
    }
  };

  const updateSoru = (anketIdx: number, soruId: string, updatedFields: Partial<Soru>) => {
    const anket = anketListesi[anketIdx];
    updateAnketField(anketIdx, 'sorular', anket.sorular.map(s => s.id === soruId ? { ...s, ...updatedFields } : s));
  };

  const handleCopyLink = (anketId: string | undefined) => {
    if (!anketId || anketId.startsWith('temp_')) {
      alert("Lütfen link alabilmek için önce anketi kaydedin!");
      return;
    }
    const link = `${window.location.origin}/anket/${anketId}`;
    navigator.clipboard.writeText(link);
    alert("Anket bağlantısı kopyalandı:\n" + link);
  };

  if (isLoading) {
    return <div className="h-full flex items-center justify-center p-20"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto animate-in fade-in duration-500">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="text-sm text-slate-500 flex items-center gap-2 font-medium">
            <span className="cursor-pointer hover:text-blue-600">Ana Sayfa</span> &gt; 
            <span className="cursor-pointer hover:text-blue-600">Ölçütler</span> &gt;
            <span className="text-slate-800">{[olcutDetay?.kod, getLocalizedField(olcutDetay, 'olcut_adi', locale)].filter(Boolean).join(' ') || `Ölçüt #${resolvedParams.id}`}</span>
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-800">
              {[olcutDetay?.kod, getLocalizedField(olcutDetay, 'olcut_adi', locale)].filter(Boolean).join(' ') || `Ölçüt #${resolvedParams.id}`}
            </h2>
          </div>
          <p className="text-sm text-slate-500">Uygulama sonuçlarını ölçmek için dış paydaş anketleri hazırlayın ve bağımsız raporlar oluşturun.</p>
        </div>
      </div>

      <StepPanel activeStepId="kontrol" altOlcutId={resolvedParams.id} />

      <div className="mb-6 flex justify-end">
        {!isReadOnly && (
          <button 
            onClick={addNewAnket}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-md shadow-purple-500/30 active:scale-[0.98]"
          >
            <Plus className="w-5 h-5" />
            Yeni Anket Ekle
          </button>
        )}
      </div>

      <div className="space-y-6 mb-8">
        {anketListesi.map((anket, anketIdx) => (
          <div key={anket.id || `temp_${anketIdx}`} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Header / Accordion Toggle */}
            <div 
              className={`p-6 flex items-center justify-between cursor-pointer transition-colors ${anket.isExpanded ? 'bg-slate-50 border-b border-slate-200' : 'hover:bg-slate-50'}`}
              onClick={() => toggleAnket(anketIdx)}
            >
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg ${anket.isExpanded ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-400'}`}>
                  {anket.isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
                <h3 className="text-xl font-bold text-slate-800">{anket.baslik}</h3>
                {isReadOnly && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded border border-amber-200">Salt Okunur</span>}
              </div>
              <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                {anket.id && !anket.id.startsWith('temp_') && (
                  <button 
                    onClick={() => handleCopyLink(anket.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors"
                  >
                    <LinkIcon className="w-3.5 h-3.5" /> Link
                  </button>
                )}
                {!isReadOnly && (
                  <button 
                    onClick={() => deleteAnket(anketIdx)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Sil
                  </button>
                )}
              </div>
            </div>

            {/* İçerik */}
            {anket.isExpanded && (
              <div className="animate-in slide-in-from-top-4 duration-300">
                {/* 1. Anket Başlığı */}
                <div className="p-8 border-b border-slate-100 bg-white">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Anket Başlığı</label>
                  <input 
                    type="text" 
                    disabled={isReadOnly}
                    value={anket.baslik}
                    onChange={(e) => updateAnketField(anketIdx, 'baslik', e.target.value)}
                    placeholder="Örn: Memnuniyet Anketi 2024"
                    className="w-full text-2xl font-black text-slate-800 border-b border-transparent hover:border-slate-200 focus:border-purple-500 focus:outline-none transition-colors bg-transparent pb-2"
                  />
                </div>

                {/* 2. Soru Oluşturucu */}
                <div className="p-8 border-b border-slate-100 bg-[#FAFAFA]">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="flex items-center gap-2 font-bold text-slate-700 text-lg">
                      <Edit3 className="w-5 h-5 text-purple-600" /> Soru Formu
                    </h3>
                    {!isReadOnly && (
                      <div className="relative group">
                        <button className="flex items-center gap-2 bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors">
                          <Plus className="w-4 h-4" /> Yeni Soru
                        </button>
                        <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 flex flex-col p-2">
                          <button onClick={() => handleAddSoru(anketIdx, 'coktan_secmeli')} className="text-left px-3 py-2 text-sm text-slate-700 hover:bg-purple-50 hover:text-purple-700 rounded-lg">Çoktan Seçmeli</button>
                          <button onClick={() => handleAddSoru(anketIdx, 'kisa_yanit')} className="text-left px-3 py-2 text-sm text-slate-700 hover:bg-purple-50 hover:text-purple-700 rounded-lg">Kısa Yanıt</button>
                          <button onClick={() => handleAddSoru(anketIdx, 'puanlama')} className="text-left px-3 py-2 text-sm text-slate-700 hover:bg-purple-50 hover:text-purple-700 rounded-lg">1-5 Puanlama</button>
                        </div>
                      </div>
                    )}
                  </div>

                  {anket.sorular.length === 0 ? (
                    <div className="text-center py-8 bg-white rounded-xl border border-dashed border-slate-300">
                      <p className="text-slate-400 font-medium text-sm">Bu ankette henüz soru yok.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {anket.sorular.map((soru, sIdx) => (
                        <div key={soru.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative group hover:shadow-md transition-shadow">
                          {!isReadOnly && (
                            <button onClick={() => handleRemoveSoru(anketIdx, soru.id)} className="absolute top-4 right-4 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          <div className="mb-4 pr-8">
                            <label className="text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1 block">
                              {sIdx + 1}. {soru.tip === 'coktan_secmeli' ? 'Çoktan Seçmeli' : soru.tip === 'kisa_yanit' ? 'Kısa Yanıt' : '1-5 Puanlama'}
                            </label>
                            <input 
                              type="text" 
                              disabled={isReadOnly}
                              value={soru.soru}
                              onChange={(e) => updateSoru(anketIdx, soru.id, { soru: e.target.value })}
                              placeholder="Sorunuzu buraya yazın..."
                              className="w-full text-base font-medium text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-200 focus:border-purple-500 focus:outline-none transition-colors"
                            />
                          </div>
                          
                          {/* Seçenekler / İçerik */}
                          <div className="pl-2">
                            {soru.tip === 'kisa_yanit' && (
                              <div className="border-b border-slate-300 border-dashed pb-2 w-1/2 text-slate-400 text-sm">Kısa yanıt metni...</div>
                            )}
                            {soru.tip === 'puanlama' && (
                              <div className="flex gap-3 items-center">
                                {[1, 2, 3, 4, 5].map(p => (
                                  <div key={p} className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 font-bold text-xs">{p}</div>
                                ))}
                              </div>
                            )}
                            {soru.tip === 'coktan_secmeli' && (
                              <div className="space-y-2">
                                {soru.secenekler?.map((secenek, secIdx) => (
                                  <div key={secenek.id} className="flex items-center gap-2">
                                    <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300"></div>
                                    <input 
                                      type="text"
                                      disabled={isReadOnly}
                                      value={secenek.metin}
                                      onChange={(e) => {
                                        const newSecenekler = soru.secenekler?.map(sec => sec.id === secenek.id ? { ...sec, metin: e.target.value } : sec);
                                        updateSoru(anketIdx, soru.id, { secenekler: newSecenekler });
                                      }}
                                      className="flex-1 text-sm bg-transparent border-b border-slate-200 focus:border-purple-500 focus:outline-none py-1 disabled:text-slate-600"
                                      placeholder={`Seçenek ${secIdx + 1}`}
                                    />
                                    {!isReadOnly && soru.secenekler && soru.secenekler.length > 1 && (
                                      <button onClick={() => {
                                        updateSoru(anketIdx, soru.id, { secenekler: soru.secenekler?.filter(sec => sec.id !== secenek.id) });
                                      }} className="text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                                    )}
                                  </div>
                                ))}
                                {!isReadOnly && (
                                  <button 
                                    onClick={() => {
                                      const newSecenekler = [...(soru.secenekler || []), { id: Math.random().toString(36).substr(2, 9), metin: `Yeni Seçenek` }];
                                      updateSoru(anketIdx, soru.id, { secenekler: newSecenekler });
                                    }}
                                    className="text-xs font-semibold text-purple-600 hover:text-purple-700 mt-2 flex items-center gap-1"
                                  >
                                    <Plus className="w-3 h-3" /> Seçenek Ekle
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. Canlı Analiz Ekranı */}
                {anket.id && !anket.id.startsWith('temp_') && (
                  <div className="p-8 border-b border-slate-100 bg-white">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="flex items-center gap-2 font-bold text-slate-700 text-lg">
                        <BarChart2 className="w-5 h-5 text-emerald-600" /> Canlı Analiz
                      </h3>
                      <div className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200">
                        Katılım: {toplamCevaplar[anket.id] || 0}
                      </div>
                    </div>
                    
                    {(toplamCevaplar[anket.id] || 0) === 0 ? (
                      <div className="text-center py-6 bg-slate-50 rounded-xl border border-slate-200">
                        <p className="text-slate-400 text-sm font-medium">Bu anket için henüz yanıt bulunmuyor.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {anket.sorular.map(soru => {
                          const ozet = (cevapOzetleri[anket.id as string] || []).find(c => c.soru_id === soru.id);

                          if (soru.tip === 'kisa_yanit') {
                            const yanitlar = ozet?.cevaplar || [];
                            return (
                              <div key={soru.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm col-span-1 lg:col-span-2">
                                <h4 className="font-semibold text-slate-700 mb-3 text-sm">{soru.soru}</h4>
                                {yanitlar.length > 0 ? (
                                  <div className="max-h-[150px] overflow-y-auto space-y-2 pr-2">
                                    {yanitlar.map((cevap, idx) => (
                                      <div key={idx} className="bg-slate-50 p-2 rounded-lg text-xs text-slate-700 border border-slate-100">{cevap}</div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-400 italic">Yanıt yok.</p>
                                )}
                              </div>
                            );
                          }

                          // Grafik Data Hazırlığı
                          const dataMap: Record<string, number> = {};
                          if (soru.tip === 'coktan_secmeli' && soru.secenekler) {
                            soru.secenekler.forEach(s => dataMap[s.id] = 0);
                            if (ozet) ozet.cevaplar.forEach(c => { if (dataMap[c] !== undefined) dataMap[c]++; });
                          } else if (soru.tip === 'puanlama') {
                            [1, 2, 3, 4, 5].forEach(p => dataMap[p.toString()] = 0);
                            if (ozet) ozet.cevaplar.forEach(c => { if (dataMap[c.toString()] !== undefined) dataMap[c.toString()]++; });
                          }

                          const chartData = Object.keys(dataMap).map(k => {
                            let name = k;
                            if (soru.tip === 'coktan_secmeli') {
                              name = soru.secenekler?.find(s => s.id === k)?.metin || k;
                            }
                            return { name, deger: dataMap[k] };
                          });

                          return (
                            <div key={soru.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[280px]">
                              <h4 className="font-semibold text-slate-700 mb-4 text-xs text-center line-clamp-2" title={soru.soru}>{soru.soru}</h4>
                              <div className="flex-1 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                    <XAxis dataKey="name" tick={{fontSize: 10, fill: '#64748B'}} axisLine={false} tickLine={false} />
                                    <YAxis allowDecimals={false} tick={{fontSize: 10, fill: '#64748B'}} axisLine={false} tickLine={false} />
                                    <RechartsTooltip formatter={(value: any) => [`${value} Yanıt`, 'Miktar']} cursor={{fill: '#F1F5F9'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }} />
                                    <Bar dataKey="deger" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={30}>
                                      {chartData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                      ))}
                                    </Bar>
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Bağımsız Değerlendirme Raporu */}
                <div className="p-8 bg-[#F8FAFC]">
                  <h3 className="flex items-center gap-2 font-bold text-slate-700 mb-3 text-lg">
                    <Settings className="w-5 h-5 text-blue-600" />
                    Değerlendirme Sonucu
                  </h3>
                  <p className="text-slate-500 mb-4 text-xs">Sadece bu anketin sonuçlarına dayanarak elde ettiğiniz bulguları buraya yazın.</p>
                  <div className="bg-white border border-slate-200 rounded-lg">
                    <RichTextEditor 
                      content={anket.aciklama} 
                      onChange={(val) => updateAnketField(anketIdx, 'aciklama', val)} 
                      readOnly={isReadOnly} 
                    />
                  </div>
                </div>

              </div>
            )}
          </div>
        ))}
      </div>

      {!isReadOnly && (
        <div className="flex justify-end p-6 bg-white border-t border-slate-200 sticky bottom-0 z-10 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)] rounded-t-2xl">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl text-sm font-bold transition-all shadow-md active:scale-[0.98] disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {isSaving ? 'Kaydediliyor...' : 'Tüm Değişiklikleri Kaydet'}
          </button>
        </div>
      )}
    </div>
  );
}
