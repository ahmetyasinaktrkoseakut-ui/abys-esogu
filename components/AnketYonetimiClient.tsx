'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Loader2, Save, Activity, Edit3, Trash2, Plus, Link as LinkIcon, ChevronDown, ChevronUp } from 'lucide-react';
import { usePeriod } from '@/contexts/PeriodContext';
import { useLocale } from 'next-intl';

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
  isExpanded?: boolean;
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
  
  const [anketListesi, setAnketListesi] = useState<Anket[]>([]);

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

        // Mevcut anketleri çekelim (Yönetim anketleri)
        const { data: existingAnketler } = await supabase
          .from('anketler')
          .select('*')
          .eq('alt_olcut_id', 'genel')
          .eq('donem_id', selectedPeriod?.id)
          .order('id', { ascending: true });

        if (existingAnketler && existingAnketler.length > 0) {
          const mappedAnketler: Anket[] = existingAnketler.map((a: any, idx: number) => ({
            id: a.id.toString(),
            baslik: a.baslik || 'Genel Anket',
            sorular: a.sorular || [],
            aciklama: a.aciklama || '',
            isExpanded: false
          }));
          setAnketListesi(mappedAnketler);
          // Hedef ölçütleri ilk anketten alalım (basitlik için hepsinin hedef_olcutler'i aynı varsayılabilir veya her anketin kendi hedef_olcutler'i olabilir. Eğer hepsi farklıysa genel bir filtrede zorluk yaşanır. Şimdilik UI'da tek bir ortak "Hedef Alt Ölçütler" alanı var, ilkini kullanacağız)
          if (existingAnketler[0].hedef_olcutler) {
            setHedefOlcutler(existingAnketler[0].hedef_olcutler);
          }
        } else {
          setAnketListesi([{
            id: undefined,
            baslik: 'Yeni Genel Anket',
            sorular: [],
            aciklama: '',
            isExpanded: true
          }]);
        }

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
        const upsertAnket: Record<string, any> = {
          alt_olcut_id: 'genel', // Special ID to indicate it's a general survey mapped via hedef_olcutler
          donem_id: selectedPeriod?.id,
          baslik: anket.baslik,
          sorular: anket.sorular,
          aciklama: anket.aciklama,
          hedef_olcutler: hedefOlcutler // JSONB array of alt_olcut_id strings
        };
        if (anket.id && !anket.id.startsWith('temp_')) {
          await supabase.from('anketler').update(upsertAnket).eq('id', anket.id);
        } else {
          await supabase.from('anketler').insert(upsertAnket);
        }
      }
      alert('Anketler başarıyla hedeflenen ölçütlere gönderildi!');
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
          Yeni Anket Ekle
        </button>
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
                <button 
                  onClick={() => deleteAnket(anketIdx)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Sil
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

      <div className="flex justify-end p-6 bg-white border-t border-slate-200 sticky bottom-0 z-10 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)] rounded-t-2xl">
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl text-sm font-bold transition-all shadow-md active:scale-[0.98] disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {isSaving ? 'Kaydediliyor...' : 'Anketleri Dağıt ve Kaydet'}
        </button>
      </div>
    </div>
  );
}
