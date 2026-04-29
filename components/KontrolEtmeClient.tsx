'use client';

import { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Loader2, Info, Save, Settings, PieChart as PieChartIcon, Plus, Trash2, Copy, BarChart2, Link as LinkIcon, Edit3 } from 'lucide-react';
import StepPanel from '@/components/StepPanel';
import RichTextEditor from '@/components/RichTextEditor';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

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

interface AnketCevapOzeti {
  soru_id: string;
  cevaplar: any[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#FF6666'];

export default function KontrolEtmeClient({ params }: KontrolEtmeClientProps) {
  const resolvedParams = use(params);
  const [olcutDetay, setOlcutDetay] = useState<any>(null);
  
  // PUKO Data
  const [aciklama, setAciklama] = useState('');
  
  // Anket Data
  const [anketId, setAnketId] = useState<string | null>(null);
  const [anketBaslik, setAnketBaslik] = useState('Değerlendirme Anketi');
  const [sorular, setSorular] = useState<Soru[]>([]);
  
  // Cevap Data
  const [cevapOzetleri, setCevapOzetleri] = useState<AnketCevapOzeti[]>([]);
  const [toplamCevap, setToplamCevap] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);

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

      // Fetch PUKO Description
      const { data: pukoData } = await supabase
        .from('puko_degerlendirmeleri')
        .select('*')
        .eq('alt_olcut_id', resolvedParams.id)
        .eq('puko_asamasi', 'kontrol')
        .order('id', { ascending: false })
        .limit(1)
        .single();

      if (pukoData) {
        setAciklama(pukoData.aciklama || '');
      }

      // Fetch Anket
      const { data: anketData } = await supabase
        .from('anketler')
        .select('*')
        .eq('alt_olcut_id', resolvedParams.id)
        .order('id', { ascending: false })
        .limit(1)
        .single();

      if (anketData) {
        setAnketId(anketData.id.toString());
        setAnketBaslik(anketData.baslik || '');
        setSorular(anketData.sorular || []);
        
        // Fetch Cevaplar
        const { data: cevaplarData } = await supabase
          .from('anket_cevaplari')
          .select('cevaplar')
          .eq('anket_id', anketData.id);

        if (cevaplarData) {
          setToplamCevap(cevaplarData.length);
          
          // Agregate Cevaplar
          const ozet: Record<string, any[]> = {};
          cevaplarData.forEach(c => {
            const yanitlar = c.cevaplar as Record<string, any>;
            if (yanitlar) {
              Object.keys(yanitlar).forEach(sId => {
                if (!ozet[sId]) ozet[sId] = [];
                ozet[sId].push(yanitlar[sId]);
              });
            }
          });

          const ozetArray = Object.keys(ozet).map(k => ({ soru_id: k, cevaplar: ozet[k] }));
          setCevapOzetleri(ozetArray);
        }
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
      // 1. Save PUKO Description
      const upsertPuko: Record<string, any> = {
        alt_olcut_id: resolvedParams.id,
        puko_asamasi: 'kontrol',
        aciklama: aciklama,
        durum: 'Beklemede',
        red_nedeni: null
      };
      
      const { data: existingPuko } = await supabase
        .from('puko_degerlendirmeleri')
        .select('id')
        .eq('alt_olcut_id', resolvedParams.id)
        .eq('puko_asamasi', 'kontrol')
        .maybeSingle();

      if (existingPuko?.id) {
        await supabase.from('puko_degerlendirmeleri').update(upsertPuko).eq('id', existingPuko.id);
      } else {
        await supabase.from('puko_degerlendirmeleri').insert(upsertPuko);
      }

      // 2. Save Anket
      if (sorular.length > 0) {
        const upsertAnket: Record<string, any> = {
          alt_olcut_id: resolvedParams.id,
          baslik: anketBaslik,
          sorular: sorular
        };

        if (anketId) {
          await supabase.from('anketler').update(upsertAnket).eq('id', anketId);
        } else {
          const { data: newAnket } = await supabase.from('anketler').insert(upsertAnket).select('id').single();
          if (newAnket) setAnketId(newAnket.id.toString());
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

  const handleAddSoru = (tip: SoruTipi) => {
    setSorular([
      ...sorular,
      {
        id: Math.random().toString(36).substr(2, 9),
        tip,
        soru: '',
        ...(tip === 'coktan_secmeli' ? { secenekler: [{ id: Math.random().toString(36).substr(2, 9), metin: 'Seçenek 1' }] } : {})
      }
    ]);
  };

  const handleRemoveSoru = (id: string) => {
    if (confirm("Bu soruyu silmek istediğinize emin misiniz?")) {
      setSorular(sorular.filter(s => s.id !== id));
    }
  };

  const handleCopyLink = () => {
    if (!anketId) {
      alert("Lütfen önce anketi kaydedin!");
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
            <span className="text-slate-800">{[olcutDetay?.kod, olcutDetay?.olcut_adi].filter(Boolean).join(' ') || `Ölçüt #${resolvedParams.id}`}</span>
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-800">
              {[olcutDetay?.kod, olcutDetay?.olcut_adi].filter(Boolean).join(' ') || `Ölçüt #${resolvedParams.id}`}
            </h2>
          </div>
          <p className="text-sm text-slate-500">Uygulama sonuçlarını ölçmek için dış paydaş anketleri hazırlayın ve sonuçları raporlayın.</p>
        </div>
      </div>

      <StepPanel activeStepId="kontrol" altOlcutId={resolvedParams.id} />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
        
        {/* FORM BUILDER */}
        <div className="p-8 border-b border-slate-200 bg-[#FAFAFA]">
          <div className="flex items-center justify-between mb-8">
            <h3 className="flex items-center gap-2 font-bold text-slate-800 text-xl">
              <Edit3 className="w-6 h-6 text-purple-600" />
              Anket Formu Oluşturucu
              {isReadOnly && <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded border border-amber-200">Salt Okunur</span>}
            </h3>
            <div className="flex gap-3">
              {anketId && (
                <button 
                  onClick={handleCopyLink}
                  className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
                >
                  <LinkIcon className="w-4 h-4" />
                  Linki Kopyala
                </button>
              )}
              {!isReadOnly && (
                <div className="relative group">
                  <button className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm">
                    <Plus className="w-4 h-4" />
                    Yeni Soru
                  </button>
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 flex flex-col p-2">
                    <button onClick={() => handleAddSoru('coktan_secmeli')} className="text-left px-3 py-2 text-sm text-slate-700 hover:bg-purple-50 hover:text-purple-700 rounded-lg">Çoktan Seçmeli</button>
                    <button onClick={() => handleAddSoru('kisa_yanit')} className="text-left px-3 py-2 text-sm text-slate-700 hover:bg-purple-50 hover:text-purple-700 rounded-lg">Kısa Yanıt</button>
                    <button onClick={() => handleAddSoru('puanlama')} className="text-left px-3 py-2 text-sm text-slate-700 hover:bg-purple-50 hover:text-purple-700 rounded-lg">1-5 Puanlama</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6 border-l-4 border-l-purple-500">
            <input 
              type="text" 
              disabled={isReadOnly}
              value={anketBaslik}
              onChange={(e) => setAnketBaslik(e.target.value)}
              placeholder="Anket Başlığı"
              className="w-full text-2xl font-black text-slate-800 border-b border-transparent hover:border-slate-300 focus:border-purple-500 focus:outline-none transition-colors bg-transparent disabled:hover:border-transparent pb-2"
            />
          </div>

          {sorular.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
              <Edit3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">Bu ankette henüz soru yok.</p>
              <p className="text-sm text-slate-400 mt-1">Soru eklemek için "Yeni Soru" butonunu kullanın.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {sorular.map((soru, index) => (
                <div key={soru.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative group hover:shadow-md transition-shadow">
                  
                  {!isReadOnly && (
                    <button onClick={() => handleRemoveSoru(soru.id)} className="absolute top-4 right-4 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}

                  <div className="mb-4 pr-10">
                    <label className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-2 block">
                      {index + 1}. {soru.tip === 'coktan_secmeli' ? 'Çoktan Seçmeli' : soru.tip === 'kisa_yanit' ? 'Kısa Yanıt' : '1-5 Puanlama'}
                    </label>
                    <input 
                      type="text" 
                      disabled={isReadOnly}
                      value={soru.soru}
                      onChange={(e) => setSorular(sorular.map(s => s.id === soru.id ? { ...s, soru: e.target.value } : s))}
                      placeholder="Sorunuzu buraya yazın..."
                      className="w-full text-lg font-medium text-slate-800 bg-slate-50 p-3 rounded-lg border border-slate-200 focus:border-purple-500 focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Soru Tiplerine Göre Render */}
                  <div className="pl-2">
                    {soru.tip === 'kisa_yanit' && (
                      <div className="border-b border-slate-300 border-dashed pb-2 w-1/2 text-slate-400 text-sm">Kısa yanıt metni buraya gelecek...</div>
                    )}

                    {soru.tip === 'puanlama' && (
                      <div className="flex gap-4 items-center">
                        {[1, 2, 3, 4, 5].map(p => (
                          <div key={p} className="w-10 h-10 rounded-full border-2 border-slate-200 flex items-center justify-center text-slate-400 font-bold">{p}</div>
                        ))}
                      </div>
                    )}

                    {soru.tip === 'coktan_secmeli' && (
                      <div className="space-y-3">
                        {soru.secenekler?.map((secenek, sIdx) => (
                          <div key={secenek.id} className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-full border-2 border-slate-300"></div>
                            <input 
                              type="text"
                              disabled={isReadOnly}
                              value={secenek.metin}
                              onChange={(e) => {
                                setSorular(sorular.map(s => {
                                  if (s.id === soru.id) {
                                    return { ...s, secenekler: s.secenekler?.map(sec => sec.id === secenek.id ? { ...sec, metin: e.target.value } : sec) };
                                  }
                                  return s;
                                }));
                              }}
                              className="flex-1 text-sm bg-transparent border-b border-slate-200 focus:border-purple-500 focus:outline-none py-1 disabled:text-slate-600"
                              placeholder={`Seçenek ${sIdx + 1}`}
                            />
                            {!isReadOnly && soru.secenekler && soru.secenekler.length > 1 && (
                              <button onClick={() => {
                                setSorular(sorular.map(s => s.id === soru.id ? { ...s, secenekler: s.secenekler?.filter(sec => sec.id !== secenek.id) } : s));
                              }} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                            )}
                          </div>
                        ))}
                        {!isReadOnly && (
                          <button 
                            onClick={() => {
                              setSorular(sorular.map(s => s.id === soru.id ? { ...s, secenekler: [...(s.secenekler || []), { id: Math.random().toString(36).substr(2, 9), metin: `Yeni Seçenek` }] } : s));
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

        {/* CANLI ANALİZ EKRANI */}
        <div className="p-8 border-b border-slate-200">
          <div className="flex items-center justify-between mb-8">
            <h3 className="flex items-center gap-2 font-bold text-slate-800 text-xl">
              <BarChart2 className="w-6 h-6 text-emerald-600" />
              Canlı Anket Yanıtları Analizi
            </h3>
            <div className="flex items-center gap-3">
              <button 
                onClick={fetchData} 
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-full font-semibold transition-colors"
              >
                Anlık Yenile
              </button>
              <div className="bg-emerald-50 text-emerald-700 px-4 py-1.5 rounded-full text-sm font-bold border border-emerald-200">
                Toplam Yanıt: {toplamCevap}
              </div>
            </div>
          </div>

          {toplamCevap === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200">
              <BarChart2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">Henüz ankete katılan kimse yok.</p>
              <p className="text-sm text-slate-400 mt-1">Dış paydaşlar link üzerinden yanıt gönderdikçe grafikler burada belirecektir.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {sorular.map((soru) => {
                const ozet = cevapOzetleri.find(c => c.soru_id === soru.id);

                if (soru.tip === 'kisa_yanit') {
                  const yanitlar = ozet?.cevaplar || [];
                  return (
                    <div key={soru.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm col-span-1 md:col-span-2">
                      <h4 className="font-semibold text-slate-700 mb-4">{soru.soru}</h4>
                      {yanitlar.length > 0 ? (
                        <div className="max-h-[200px] overflow-y-auto space-y-2 pr-2">
                          {yanitlar.map((cevap, idx) => (
                            <div key={idx} className="bg-slate-50 p-3 rounded-lg text-sm text-slate-700 border border-slate-100">{cevap}</div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400 italic">Bu soruya henüz yanıt verilmemiş.</p>
                      )}
                    </div>
                  );
                }

                // Çoktan Seçmeli & Puanlama İçin Sütun Grafiği (BarChart) Hesaplama
                const dataMap: Record<string, number> = {};
                if (soru.tip === 'coktan_secmeli' && soru.secenekler) {
                  soru.secenekler.forEach(s => dataMap[s.id] = 0);
                  if (ozet) {
                    ozet.cevaplar.forEach(c => {
                      if (dataMap[c] !== undefined) dataMap[c]++;
                    });
                  }
                } else if (soru.tip === 'puanlama') {
                  [1, 2, 3, 4, 5].forEach(p => dataMap[p.toString()] = 0);
                  if (ozet) {
                    ozet.cevaplar.forEach(c => {
                      if (dataMap[c.toString()] !== undefined) dataMap[c.toString()]++;
                    });
                  }
                }

                const chartData = Object.keys(dataMap).map(k => {
                  let name = k;
                  if (soru.tip === 'coktan_secmeli') {
                    name = soru.secenekler?.find(s => s.id === k)?.metin || k;
                  }
                  return { name, deger: dataMap[k] };
                });

                return (
                  <div key={soru.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[350px]">
                    <h4 className="font-semibold text-slate-700 mb-6 text-center">{soru.soru}</h4>
                    <div className="flex-1 w-full" style={{ minHeight: '250px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 20, right: 30, bottom: 20, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                          <XAxis 
                            dataKey="name" 
                            tick={{fontSize: 12, fill: '#64748B'}} 
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis 
                            allowDecimals={false} 
                            tick={{fontSize: 12, fill: '#64748B'}} 
                            axisLine={false}
                            tickLine={false}
                          />
                          <RechartsTooltip 
                            formatter={(value: number) => [`${value} Yanıt`, 'Miktar']} 
                            cursor={{fill: '#F1F5F9'}} 
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          />
                          <Bar dataKey="deger" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={40}>
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

        {/* RAPOR EDİTÖRÜ */}
        <div className="p-8">
          <h3 className="flex items-center gap-2 font-bold text-slate-800 mb-4 text-xl">
            <Settings className="w-6 h-6 text-blue-600" />
            Kontrol Raporu (Analiz Sonuçları)
          </h3>
          <p className="text-slate-500 mb-6 text-sm">Anket sonuçlarına dayanarak ölçüt ile ilgili elde ettiğiniz bulguları ve kontrol raporunuzu buraya yazın.</p>
          <div className="w-full">
            <RichTextEditor content={aciklama} onChange={setAciklama} readOnly={isReadOnly} />
          </div>
        </div>

        {!isReadOnly && (
          <div className="flex justify-end p-6 pt-0 mt-4 border-t border-slate-100 bg-slate-50/50">
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {isSaving ? 'Kaydediliyor...' : 'Anketi ve Raporu Kaydet'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
