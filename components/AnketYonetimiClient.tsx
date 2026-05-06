'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Loader2, Save, Activity, Edit3, Trash2, Plus, Link as LinkIcon, ChevronDown, ChevronUp, BarChart2 } from 'lucide-react';
import { usePeriod } from '@/contexts/PeriodContext';
import { useLocale } from 'next-intl';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Cell } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#FF6666'];

type SoruTipi = 'kisa_yanit' | 'coktan_secmeli' | 'puanlama';

interface Secenek {
  id: string;
  metin: string;
}

interface Soru {
  id: string;
  tip: SoruTipi;
  soru: string;
  secenekler?: Secenek[];
}

interface Anket {
  id?: string;
  baslik: string;
  sorular: Soru[];
  aciklama: string;
  hedef_olcutler?: string[];
  isExpanded?: boolean;
}

interface AnketCevapOzeti {
  soru_id: string;
  cevaplar: any[];
}

export default function AnketYonetimiClient() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCoordinator, setIsCoordinator] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { selectedPeriod } = usePeriod();
  const locale = useLocale();

  const [olcutler, setOlcutler] = useState<any[]>([]);
  const [hedefOlcutler, setHedefOlcutler] = useState<string[]>([]);
  
  // Sadece form (taslak) anketler için
  const [anketListesi, setAnketListesi] = useState<Anket[]>([{
    id: `temp_${Math.random().toString(36).substr(2, 9)}`,
    baslik: '',
    sorular: [],
    aciklama: '',
    isExpanded: true
  }]);
  
  // Yayınlanmış anketler (Yalnızca gösterim için)
  const [yayinlananAnketler, setYayinlananAnketler] = useState<Anket[]>([]);
  
  // Analiz verileri
  const [cevapOzetleri, setCevapOzetleri] = useState<Record<string, AnketCevapOzeti[]>>({});
  const [toplamCevaplar, setToplamCevaplar] = useState<Record<string, number>>({});

  const fetchPublishedAnketler = async (userIsAdmin: boolean, expectedDbBaslik: string | null, tumOlcutlerData: any[]) => {
    if (!selectedPeriod) return;
    
    const gecerliOlcutler = userIsAdmin ? tumOlcutlerData : tumOlcutlerData.filter(o => o.baslik === expectedDbBaslik);
    const gecerliIdler = gecerliOlcutler.flatMap(o => o.altOlcutler.map((ao: any) => ao.id.toString()));

    const { data: existingAnketler } = await supabase
      .from('anketler')
      .select('*')
      .eq('alt_olcut_id', 'genel')
      .eq('donem_id', selectedPeriod.id)
      .order('id', { ascending: true });

    if (existingAnketler && existingAnketler.length > 0) {
      const filteredAnketler = userIsAdmin ? existingAnketler : existingAnketler.filter(a => {
        if (!a.hedef_olcutler) return false;
        return a.hedef_olcutler.some((id: string) => gecerliIdler.includes(id));
      });

      const mappedAnketler: Anket[] = filteredAnketler.map((a: any) => ({
        id: a.id.toString(),
        baslik: a.baslik || 'İsimsiz Anket',
        sorular: a.sorular || [],
        aciklama: a.aciklama || '',
        hedef_olcutler: a.hedef_olcutler || [],
        isExpanded: false
      }));
      
      setYayinlananAnketler(mappedAnketler);

      // Fetch Cevaplar for Charts
      const anketIds = filteredAnketler.map(a => a.id);
      if (anketIds.length > 0) {
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
      }
    } else {
      setYayinlananAnketler([]);
    }
  };

  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase.from('profiller').select('rol').eq('id', user.id).single();
        const role = profile?.rol?.toLowerCase() || '';
        const userIsAdmin = role.includes('yonetici') || role.includes('yönetici') || role.includes('admin');
        setIsAdmin(userIsAdmin);

        let expectedDbBaslik: string | null = null;
        if (!userIsAdmin) {
          const { data: coordData } = await supabase.from('baslik_koordinatorleri').select('baslik').eq('kullanici_id', user.id).single();
          if (coordData) {
            setIsCoordinator(true);
            const baslikMap: Record<string, string> = {
              'Kalite Güvencesi': 'KALİTE GÜVENCESİ SİSTEMİ',
              'Eğitim-Öğretim': 'EĞİTİM VE ÖĞRETİM',
              'Araştırma ve Geliştirme': 'ARAŞTIRMA VE GELİŞTİRME',
              'Toplumsal Katkı': 'TOPLUMSAL KATKI',
              'Yönetim Sistemi': 'YÖNETİM SİSTEMİ'
            };
            expectedDbBaslik = baslikMap[coordData.baslik];
          } else {
            setIsLoading(false);
            return;
          }
        }

        const { data: allBasliklar } = await supabase.from('ana_basliklar').select('*');
        const { data: allAltOlcutlerData } = await supabase.from('alt_olcutler').select('*').order('kod', { ascending: true });

        const tumOlcutler = (allBasliklar || []).map(ana => {
          const anaAltOlcutler = (allAltOlcutlerData || []).filter(ao => {
            return (ao.kod && ana.kod && ao.kod.startsWith(ana.kod));
          });
          return {
            baslik: ana.baslik_adi,
            kod: ana.kod,
            id: ana.id,
            altOlcutler: anaAltOlcutler
          };
        });

        if (userIsAdmin) {
          setOlcutler(tumOlcutler);
        } else if (expectedDbBaslik) {
          const secili = tumOlcutler.filter(o => o.baslik === expectedDbBaslik);
          setOlcutler(secili);
        }

        await fetchPublishedAnketler(userIsAdmin, expectedDbBaslik, tumOlcutler);

      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, [selectedPeriod]);

  const handleSave = async () => {
    if (!selectedPeriod) return;
    if (hedefOlcutler.length === 0) {
      alert('Lütfen en az bir hedef alt ölçüt seçiniz.');
      return;
    }
    setIsSaving(true);
    try {
      for (const anket of anketListesi) {
        // Yeni bir anket olarak veritabanına atılır (ID gönderilmez)
        const insertAnket: Record<string, any> = {
          alt_olcut_id: 'genel',
          donem_id: selectedPeriod?.id,
          baslik: anket.baslik,
          sorular: anket.sorular,
          aciklama: anket.aciklama,
          hedef_olcutler: hedefOlcutler
        };
        await supabase.from('anketler').insert(insertAnket);
      }
      
      // State sıfırlama (Temizlik kuralı)
      setHedefOlcutler([]);
      setAnketListesi([{
        id: `temp_${Math.random().toString(36).substr(2, 9)}`,
        baslik: '',
        sorular: [],
        aciklama: '',
        isExpanded: true
      }]);

      alert('Anket Başarıyla Oluşturuldu ve Dağıtıldı');

      // Yeni anketlerin listeye düşmesi için yayınlananları tekrar çekiyoruz
      // expectedDbBaslik mantığını profil check'den geçirmeden yapabilmek için sayfayı reload yapmak en kolayıdır,
      // veya yeniden fetch yapabiliriz. 
      window.location.reload();

    } catch (error: any) {
      console.error(error);
      alert('Kaydedilirken bir hata oluştu: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleOlcut = (id: string) => {
    setHedefOlcutler(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAll = () => {
    const allIds = olcutler.flatMap(o => o.altOlcutler.map((ao: any) => ao.id.toString()));
    setHedefOlcutler(allIds);
  };
  const deselectAll = () => setHedefOlcutler([]);

  const addNewAnket = () => {
    const tempId = 'temp_' + Math.random().toString(36).substr(2, 9);
    setAnketListesi(prev => [
      ...prev.map(a => ({...a, isExpanded: false})),
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

  const deleteAnketFormItem = (idx: number) => {
    if (anketListesi.length === 1) {
      alert("En az bir anket formu açık olmalıdır.");
      return;
    }
    setAnketListesi(prev => prev.filter((_, i) => i !== idx));
  };

  // Yayınlanmış anket silme
  const deleteYayinlananAnket = async (anketId: string, baslik: string) => {
    if (confirm(`"${baslik}" anketini kalıcı olarak silmek istediğinize emin misiniz?`)) {
      try {
        await supabase.from('anketler').delete().eq('id', anketId);
        setYayinlananAnketler(prev => prev.filter(a => a.id !== anketId));
      } catch (err) {
        console.error("Silme hatası:", err);
      }
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

  // Helper to find olcut codes based on ID
  const getOlcutKods = (ids: string[]) => {
    const matched: string[] = [];
    olcutler.forEach(ana => {
      ana.altOlcutler.forEach((ao: any) => {
        if (ids.includes(ao.id.toString())) {
          matched.push(ao.kod);
        }
      });
    });
    return matched;
  };

  if (isLoading) {
    return <div className="h-full flex items-center justify-center min-h-[400px]"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>;
  }

  if (!isAdmin && !isCoordinator) {
    return <div className="p-8 text-center text-red-500 font-bold">Bu sayfaya erişim yetkiniz yok.</div>;
  }

  return (
    <div className="p-8 max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Activity className="w-6 h-6 text-purple-600" />
          Anket Yönetimi ve Dağıtımı
        </h2>
        <p className="text-slate-500 mt-2">Gelişmiş anketler oluşturun ve seçtiğiniz ölçütlerin "Kontrol Et" sayfalarına dağıtın.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <label className="block text-md font-bold text-slate-800">Hedef Alt Ölçütler (Çoklu Seçim)</label>
          <div className="space-x-2">
            <button onClick={selectAll} className="text-xs font-semibold text-purple-600 bg-purple-50 px-3 py-1.5 rounded-lg hover:bg-purple-100">Tümünü Seç</button>
            <button onClick={deselectAll} className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg hover:bg-slate-200">Seçimi Temizle</button>
          </div>
        </div>
        
        <div className="max-h-[300px] overflow-y-auto border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-4">
          {olcutler.map(ana => (
            <div key={ana.id} className="space-y-2">
              <h3 className="font-bold text-slate-700 text-sm border-b pb-1">{ana.kod} - {ana.baslik}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-2">
                {ana.altOlcutler.map((ao: any) => {
                  const idStr = ao.id.toString();
                  const isSelected = hedefOlcutler.includes(idStr);
                  return (
                    <label key={ao.id} className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-purple-100 border-purple-200 border' : 'hover:bg-slate-200 border border-transparent'}`}>
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={() => toggleOlcut(idStr)}
                        className="mt-1 w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                      />
                      <span className="text-xs font-medium text-slate-700 leading-tight">
                        <span className="font-bold">{ao.kod}</span> - {ao.olcut_adi || ao.ad || ao.baslik}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
          {olcutler.length === 0 && <p className="text-sm text-slate-500">Gösterilecek ölçüt bulunamadı.</p>}
        </div>
        <p className="text-xs text-slate-500 mt-2">Seçilen ölçüt sayısı: <strong className="text-purple-600">{hedefOlcutler.length}</strong></p>
      </div>

      <div className="mb-6 flex justify-end">
        <button 
          onClick={addNewAnket}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-md shadow-purple-500/30 active:scale-[0.98]"
        >
          <Plus className="w-5 h-5" />
          Yeni Form Ekle
        </button>
      </div>

      <div className="space-y-6 mb-8">
        {anketListesi.map((anket, anketIdx) => (
          <div key={anket.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Header / Accordion Toggle */}
            <div 
              className={`p-6 flex items-center justify-between cursor-pointer transition-colors ${anket.isExpanded ? 'bg-slate-50 border-b border-slate-200' : 'hover:bg-slate-50'}`}
              onClick={() => toggleAnket(anketIdx)}
            >
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg ${anket.isExpanded ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-400'}`}>
                  {anket.isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
                <h3 className="text-xl font-bold text-slate-800">{anket.baslik || 'İsimsiz Anket Formu'}</h3>
              </div>
              <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                <button 
                  onClick={() => deleteAnketFormItem(anketIdx)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Formu Sil
                </button>
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
                    value={anket.baslik}
                    onChange={(e) => updateAnketField(anketIdx, 'baslik', e.target.value)}
                    placeholder="Örn: Kurumsal Değerlendirme Anketi"
                    className="w-full text-2xl font-black text-slate-800 border-b border-transparent hover:border-slate-200 focus:border-purple-500 focus:outline-none transition-colors bg-transparent pb-2"
                  />
                </div>

                {/* 2. Soru Oluşturucu */}
                <div className="p-8 bg-[#FAFAFA]">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="flex items-center gap-2 font-bold text-slate-700 text-lg">
                      <Edit3 className="w-5 h-5 text-purple-600" /> Soru Formu
                    </h3>
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
                  </div>

                  {anket.sorular.length === 0 ? (
                    <div className="text-center py-8 bg-white rounded-xl border border-dashed border-slate-300">
                      <p className="text-slate-400 font-medium text-sm">Bu ankette henüz soru yok.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {anket.sorular.map((soru, sIdx) => (
                        <div key={soru.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative group hover:shadow-md transition-shadow">
                          <button onClick={() => handleRemoveSoru(anketIdx, soru.id)} className="absolute top-4 right-4 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <div className="mb-4 pr-8">
                            <label className="text-[10px] font-bold text-purple-600 uppercase tracking-wider mb-1 block">
                              {sIdx + 1}. {soru.tip === 'coktan_secmeli' ? 'Çoktan Seçmeli' : soru.tip === 'kisa_yanit' ? 'Kısa Yanıt' : '1-5 Puanlama'}
                            </label>
                            <input 
                              type="text" 
                              value={soru.soru}
                              onChange={(e) => updateSoru(anketIdx, soru.id, { soru: e.target.value })}
                              placeholder="Sorunuzu buraya yazın..."
                              className="w-full text-base font-medium text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-200 focus:border-purple-500 focus:outline-none transition-colors"
                            />
                          </div>
                          
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
                                      value={secenek.metin}
                                      onChange={(e) => {
                                        const newSecenekler = soru.secenekler?.map(sec => sec.id === secenek.id ? { ...sec, metin: e.target.value } : sec);
                                        updateSoru(anketIdx, soru.id, { secenekler: newSecenekler });
                                      }}
                                      className="flex-1 text-sm bg-transparent border-b border-slate-200 focus:border-purple-500 focus:outline-none py-1"
                                      placeholder={`Seçenek ${secIdx + 1}`}
                                    />
                                    {soru.secenekler && soru.secenekler.length > 1 && (
                                      <button onClick={() => {
                                        updateSoru(anketIdx, soru.id, { secenekler: soru.secenekler?.filter(sec => sec.id !== secenek.id) });
                                      }} className="text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                                    )}
                                  </div>
                                ))}
                                <button 
                                  onClick={() => {
                                    const newSecenekler = [...(soru.secenekler || []), { id: Math.random().toString(36).substr(2, 9), metin: `Yeni Seçenek` }];
                                    updateSoru(anketIdx, soru.id, { secenekler: newSecenekler });
                                  }}
                                  className="text-xs font-semibold text-purple-600 hover:text-purple-700 mt-2 flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" /> Seçenek Ekle
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end p-6 bg-white border-t border-slate-200 sticky bottom-0 z-10 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)] rounded-t-2xl mb-12">
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl text-sm font-bold transition-all shadow-md active:scale-[0.98] disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {isSaving ? 'Kaydediliyor...' : 'Anketleri Dağıt ve Kaydet'}
        </button>
      </div>

      {/* 3. Yayınlanan Anketler ve Canlı Analizler Paneli */}
      {yayinlananAnketler.length > 0 && (
        <div className="mt-12">
          <div className="flex items-center gap-3 mb-6 border-b border-slate-200 pb-4">
            <div className="bg-purple-100 p-2 rounded-lg"><BarChart2 className="w-6 h-6 text-purple-600" /></div>
            <h2 className="text-2xl font-bold text-slate-800">Yayınlanan Anketler ve Canlı Analizler</h2>
          </div>

          <div className="space-y-8">
            {yayinlananAnketler.map(anket => {
              const anketId = anket.id as string;
              const yanitSayisi = toplamCevaplar[anketId] || 0;
              const hedefler = getOlcutKods(anket.hedef_olcutler || []);

              return (
                <div key={`analiz_${anketId}`} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-6 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-bold text-slate-800">{anket.baslik}</h3>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-lg border border-purple-200">
                          {yanitSayisi} Yanıt
                        </span>
                        <button 
                          onClick={() => handleCopyLink(anketId)}
                          className="flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors"
                        >
                          <LinkIcon className="w-3.5 h-3.5" /> Linki Kopyala
                        </button>
                        <button 
                          onClick={() => deleteYayinlananAnket(anketId, anket.baslik)}
                          className="flex items-center gap-1.5 px-2 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Anketi Kaldır
                        </button>
                      </div>
                    </div>
                    {hedefler.length > 0 && (
                      <div className="flex flex-col gap-1 md:items-end">
                        <span className="text-xs font-bold text-slate-500 uppercase">Atanan Ölçütler (Gizli)</span>
                        <div className="flex flex-wrap gap-1 md:justify-end max-w-sm">
                          {hedefler.map(k => (
                            <span key={k} className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-bold rounded border border-slate-300">
                              {k}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-6">
                    {yanitSayisi === 0 ? (
                      <div className="text-center py-8 text-slate-500 font-medium text-sm bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        Henüz hiç yanıt alınmamış.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {anket.sorular.filter(s => s.tip !== 'kisa_yanit').map((soru) => {
                          const soruOzetleri = cevapOzetleri[anketId]?.find(co => co.soru_id === soru.id)?.cevaplar || [];
                          let chartData: any[] = [];
                          
                          if (soru.tip === 'coktan_secmeli') {
                            const frequency: Record<string, number> = {};
                            soruOzetleri.forEach(c => {
                              if (Array.isArray(c)) c.forEach(item => frequency[item] = (frequency[item] || 0) + 1);
                              else frequency[c] = (frequency[c] || 0) + 1;
                            });
                            chartData = (soru.secenekler || []).map(sec => ({
                              name: sec.metin,
                              deger: frequency[sec.id] || 0
                            }));
                          } else if (soru.tip === 'puanlama') {
                            const frequency: Record<number, number> = {1:0, 2:0, 3:0, 4:0, 5:0};
                            soruOzetleri.forEach(c => {
                              const v = parseInt(c);
                              if (!isNaN(v) && v >= 1 && v <= 5) frequency[v] += 1;
                            });
                            chartData = [1,2,3,4,5].map(v => ({ name: `${v} Puan`, deger: frequency[v] }));
                          }

                          return (
                            <div key={`chart_${soru.id}`} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[280px]">
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
                        {anket.sorular.filter(s => s.tip !== 'kisa_yanit').length === 0 && (
                          <div className="col-span-full text-center py-4 text-slate-500 text-sm">Grafiği çizilebilecek soru tipi bulunamadı.</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
